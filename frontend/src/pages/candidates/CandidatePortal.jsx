import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { request } from '../../api/client';

const SECTION_ICONS = {
  equipment: '💻',
  software: '🔑',
  training: '🎓',
};

export default function CandidatePortal() {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const [checklist, setChecklist] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null); // item_id being toggled

  if (!user) return <Navigate to="/candidate/login" replace />;
  if (user.role !== 'Candidate') return <Navigate to="/" replace />;

  const candidateId = user.candidate_id || '';

  useEffect(() => {
    if (!candidateId) {
      setLoading(false);
      return;
    }
    request(`/api/onboarding/${candidateId}`, { token })
      .then((data) => {
        setChecklist(data);
      })
      .catch(() => {
        setChecklist(null);
      })
      .finally(() => setLoading(false));
  }, [candidateId, token]);

  const toggleItem = async (itemId) => {
    if (!checklist || saving) return;
    setSaving(itemId);
    const newCompleted = { ...checklist.completed_items, [itemId]: !checklist.completed_items[itemId] };
    try {
      const updated = await request(`/api/onboarding/${candidateId}`, {
        method: 'PUT',
        token,
        body: { completed_items: newCompleted },
      });
      setChecklist(updated);
      if (updated.status === 'completed') {
        // Show celebration briefly
      }
    } catch (err) {
      console.error('Failed to save:', err);
    } finally {
      setSaving(null);
    }
  };

  const getRequiredItems = () => {
    if (!checklist) return [];
    const items = [];
    if (checklist.laptop_required) items.push({ id: 'laptop', label: `Company laptop (${checklist.laptop_spec || 'Standard build'})`, section: 'equipment' });
    if (checklist.badge_required) items.push({ id: 'badge', label: 'Building badge / on-site access', section: 'equipment' });
    (checklist.software || []).forEach((s) => {
      if (s.enabled) items.push({ id: s.id, label: s.label, section: 'software', note: s.note });
    });
    (checklist.training || []).forEach((t) => {
      if (t.enabled) items.push({ id: t.id, label: t.label, section: 'training', mandatory: t.mandatory, note: t.note });
    });
    (checklist.custom_items || []).forEach((ci) => {
      if (ci.enabled) items.push({ id: ci.id, label: ci.label, section: ci.section, custom: true, note: ci.note });
    });
    return items;
  };

  const requiredItems = getRequiredItems();
  const completedCount = requiredItems.filter((item) => checklist?.completed_items?.[item.id]).length;
  const totalRequired = requiredItems.length;
  const progress = totalRequired > 0 ? Math.round((completedCount / totalRequired) * 100) : 0;
  const isComplete = checklist?.status === 'completed';

  if (loading) {
    return (
      <div style={{ fontFamily: "'Inter', sans-serif", minHeight: '100vh', background: '#f7f7f5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '1.2rem', color: '#64748b' }}>Loading your onboarding...</div>
        </div>
      </div>
    );
  }

  if (!checklist) {
    return (
      <div style={{ fontFamily: "'Inter', sans-serif", minHeight: '100vh', background: '#f7f7f5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', maxWidth: 440, padding: 40 }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 16 }}>📋</div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>No onboarding setup yet</h2>
          <p style={{ fontSize: '0.9rem', color: '#64748b', lineHeight: 1.6 }}>
            Your hiring manager hasn't set up your onboarding checklist yet. Please check back later or contact your manager.
          </p>
          <button onClick={logout} style={{ marginTop: 24, padding: '10px 24px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>
            Sign out
          </button>
        </div>
      </div>
    );
  }

  // Group items by section
  const grouped = {};
  requiredItems.forEach((item) => {
    if (!grouped[item.section]) grouped[item.section] = [];
    grouped[item.section].push(item);
  });

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", minHeight: '100vh', background: '#f7f7f5' }}>
      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e5e5e0', padding: '16px 24px' }}>
        <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: '0.65rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#94a3b8', fontFamily: 'monospace' }}>
              TermJobs Candidate Portal
            </span>
          </div>
          {!isComplete && (
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
              {completedCount}/{totalRequired} completed
            </span>
          )}
          {isComplete && (
            <button onClick={logout} style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}>
              Sign out
            </button>
          )}
        </div>
      </div>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 16px 48px' }}>
        {/* Profile Card */}
        <div style={{ background: '#fff', border: '1px solid #e5e5e0', borderRadius: 12, padding: 20, marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: isComplete ? '#059669' : '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: '0.85rem' }}>
              {(user.name || 'C')[0].toUpperCase()}
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '1rem', color: '#0f172a' }}>{user.name}</div>
              <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{user.email}</div>
            </div>
            <div style={{ marginLeft: 'auto' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 600, padding: '4px 10px', borderRadius: 6, background: isComplete ? '#d1fae5' : checklist.status === 'in_progress' ? '#fef3c7' : '#f1f5f9', color: isComplete ? '#065f46' : checklist.status === 'in_progress' ? '#92400e' : '#64748b' }}>
                {isComplete ? '✓ Completed' : checklist.status === 'in_progress' ? 'In Progress' : 'Not Started'}
              </span>
            </div>
          </div>
          {!isComplete && totalRequired > 0 && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#64748b', marginBottom: 4 }}>
                <span>Progress</span>
                <span style={{ fontWeight: 600 }}>{progress}%</span>
              </div>
              <div style={{ height: 6, background: '#e5e5e0', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${progress}%`, background: progress === 100 ? '#059669' : '#d97706', borderRadius: 3, transition: 'width 0.3s ease' }} />
              </div>
            </div>
          )}
        </div>

        {/* Completion celebration */}
        {isComplete && (
          <div style={{ background: '#d1fae5', border: '1px solid #6ee7b7', borderRadius: 12, padding: 20, marginBottom: 20, textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', marginBottom: 8 }}>🎉</div>
            <div style={{ fontWeight: 700, fontSize: '1.1rem', color: '#065f46', marginBottom: 4 }}>Onboarding Complete!</div>
            <div style={{ fontSize: '0.85rem', color: '#047857' }}>You've completed all onboarding items. Welcome aboard!</div>
          </div>
        )}

        {/* Onboarding Checklist */}
        {!isComplete && Object.keys(grouped).length > 0 && (
          <>
            <div style={{ fontSize: '0.72rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 600, marginBottom: 12 }}>
              Onboarding Checklist
            </div>

            {Object.entries(grouped).map(([section, items]) => (
              <div key={section} style={{ background: '#fff', border: '1px solid #e5e5e0', borderRadius: 12, padding: 16, marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid #f1f0ec' }}>
                  <span>{SECTION_ICONS[section] || '📌'}</span>
                  <span style={{ fontWeight: 700, fontSize: '0.88rem', color: '#0f172a', textTransform: 'capitalize' }}>{section}</span>
                </div>
                {items.map((item) => {
                  const done = !!checklist.completed_items[item.id];
                  return (
                    <div key={item.id} onClick={() => toggleItem(item.id)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid #f8f8f6', cursor: 'pointer', opacity: saving === item.id ? 0.5 : 1 }}>
                      <div style={{ width: 22, height: 22, borderRadius: '50%', border: `2px solid ${done ? '#059669' : '#d1d5db'}`, background: done ? '#059669' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.2s' }}>
                        {done && <span style={{ color: '#fff', fontSize: '0.7rem', fontWeight: 700 }}>✓</span>}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.88rem', color: done ? '#059669' : '#0f172a', fontWeight: done ? 500 : 400, textDecoration: done ? 'line-through' : 'none' }}>{item.label}</div>
                        {item.note && <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: 2 }}>{item.note}</div>}
                      </div>
                      {item.mandatory && <span style={{ fontSize: '0.65rem', color: '#94a3b8', background: '#f1f5f9', padding: '2px 6px', borderRadius: 4 }}>Required</span>}
                      {item.custom && <span style={{ fontSize: '0.65rem', color: '#7c3aed', background: '#ede9fe', padding: '2px 6px', borderRadius: 4 }}>Custom</span>}
                    </div>
                  );
                })}
              </div>
            ))}

            {/* Reminder */}
            <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 10, padding: 14, marginTop: 8, fontSize: '0.82rem', color: '#9a3412', textAlign: 'center' }}>
              ⚠️ You must complete all items above before accessing your candidate dashboard.
            </div>
          </>
        )}

        {/* Dashboard - shown only when onboarding is complete */}
        {isComplete && (
          <div>
            <div style={{ fontSize: '0.72rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 600, marginBottom: 12 }}>
              Your Profile
            </div>
            <div style={{ background: '#fff', border: '1px solid #e5e5e0', borderRadius: 12, padding: 20 }}>
              <div style={{ display: 'grid', gap: 14 }}>
                {[
                  ['Name', user.name],
                  ['Email', user.email],
                  ['Tenant', user.tenant_name],
                  ['Company', user.tenant_name],
                  ['Role', user.role],
                ].filter(([, v]) => v).map(([label, value]) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 10, borderBottom: '1px solid #f1f0ec' }}>
                    <span style={{ fontSize: '0.8rem', color: '#64748b' }}>{label}</span>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#0f172a' }}>{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
