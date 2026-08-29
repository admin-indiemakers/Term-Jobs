import { useEffect, useState, useMemo } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { request } from '../../api/client';
import {
  Laptop, Monitor, BookOpen, CheckCircle2,
  ArrowRight, Shield, ClipboardCheck, AlertCircle,
  LogOut, CheckCheck, Lock, Info, Loader2,
  Flag, X, Send, AlertTriangle, CheckCircle,
  Wifi, Mail, Building, GraduationCap,
} from 'lucide-react';

const ISSUE_CATEGORIES = [
  { id: 'hardware', label: 'Laptop / Hardware', icon: Laptop },
  { id: 'access', label: 'VPN / System Access', icon: Wifi },
  { id: 'email', label: 'Email / Communication Tools', icon: Mail },
  { id: 'software', label: 'Software / Licenses', icon: Monitor },
  { id: 'training', label: 'Training / Onboarding', icon: GraduationCap },
  { id: 'badge', label: 'Badge / ID Card', icon: Shield },
  { id: 'workspace', label: 'Workspace / Seating', icon: Building },
  { id: 'other', label: 'Other', icon: AlertTriangle },
];

export default function CandidateOnboarding() {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [onboarding, setOnboarding] = useState(null);
  const [completedItems, setCompletedItems] = useState({});

  // Raise Issue state
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [issueCategory, setIssueCategory] = useState('');
  const [issueDescription, setIssueDescription] = useState('');
  const [submittingIssue, setSubmittingIssue] = useState(false);

  // Notifications (inline on screen)
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    loadOnboarding();
    loadNotifications();
  }, [token]);

  // Auto-dismiss success message
  useEffect(() => {
    if (successMsg) {
      const t = setTimeout(() => setSuccessMsg(''), 4000);
      return () => clearTimeout(t);
    }
  }, [successMsg]);

  async function loadOnboarding() {
    setLoading(true);
    setError('');
    try {
      const candId = user.candidate_id || '';
      const res = await request(`/api/onboarding/${candId}`, { token });
      if (res) {
        setOnboarding(res);
        setCompletedItems(res.completed_items || {});
      }
    } catch (err) {
      if (err.status === 404 || (err.message && err.message.includes('404'))) {
        setOnboarding(null);
        setError('pending');
      } else {
        setError(err.message || 'Failed to load onboarding checklist.');
      }
    } finally {
      setLoading(false);
    }
  }

  async function loadNotifications() {
    try {
      const candId = user.candidate_id || '';
      const res = await request(`/api/onboarding/notifications/${candId}`, { token });
      if (Array.isArray(res)) {
        setNotifications(res);
      }
    } catch (err) { /* ignore */ }
  }

  async function handleDismissNotif(notifId) {
    setNotifications((prev) => prev.filter((n) => n.id !== notifId));
    try {
      await request(`/api/onboarding/notifications/${notifId}/read`, { method: 'POST', token });
    } catch (err) { /* ignore */ }
  }

  // Submit issue
  async function handleSubmitIssue() {
    if (!issueCategory || !issueDescription.trim()) return;
    setSubmittingIssue(true);
    try {
      const candId = user.candidate_id || '';
      await request('/api/onboarding/issues', {
        method: 'POST',
        token,
        body: {
          candidate_id: candId,
          candidate_name: user.name || '',
          category: issueCategory,
          category_label: ISSUE_CATEGORIES.find((c) => c.id === issueCategory)?.label || 'Issue',
          description: issueDescription.trim(),
        },
      });
      setShowIssueModal(false);
      setIssueCategory('');
      setIssueDescription('');
      setSuccessMsg('Issue reported successfully! Your hiring manager will review it shortly.');
    } catch (err) {
      setError(err.message || 'Failed to report issue.');
    } finally {
      setSubmittingIssue(false);
    }
  }

  // Build the list of enabled onboarding items
  const items = useMemo(() => {
    if (!onboarding) return [];
    const list = [];
    if (onboarding.laptop_required) {
      list.push({ id: 'laptop', label: `Laptop — ${onboarding.laptop_spec || 'Standard build'}`, category: 'equipment' });
    }
    if (onboarding.badge_required) {
      list.push({ id: 'badge', label: 'Access badge / ID card', category: 'equipment' });
    }
    (onboarding.software || []).forEach((s) => {
      if (s.enabled) list.push({ id: s.id, label: s.label, category: 'software' });
    });
    (onboarding.training || []).forEach((t) => {
      if (t.enabled) list.push({ id: t.id, label: t.label, category: 'training', mandatory: t.mandatory });
    });
    (onboarding.custom_items || []).forEach((ci) => {
      if (ci.enabled) list.push({ id: ci.id || ci.label, label: ci.label, category: 'custom' });
    });
    return list;
  }, [onboarding]);

  const totalItems = items.length;
  const completedCount = items.filter((it) => completedItems[it.id]).length;
  const progressPct = totalItems > 0 ? Math.round((completedCount / totalItems) * 100) : 0;
  const isComplete = onboarding?.status === 'completed' || (totalItems > 0 && completedCount >= totalItems);

  const handleToggle = async (itemId) => {
    const newCompleted = { ...completedItems };
    if (newCompleted[itemId]) {
      delete newCompleted[itemId];
    } else {
      newCompleted[itemId] = true;
    }
    setCompletedItems(newCompleted);
    setSaving(true);
    try {
      const candId = user.candidate_id || '';
      const res = await request(`/api/onboarding/${candId}`, {
        method: 'PUT',
        token,
        body: { completed_items: newCompleted },
      });
      if (res) {
        setOnboarding(res);
        if (res.completed_items) setCompletedItems(res.completed_items);
      }
      setSuccessMsg('Progress saved!');
    } catch (err) {
      setError(err.message || 'Failed to save progress.');
      setCompletedItems(onboarding?.completed_items || {});
    } finally {
      setSaving(false);
    }
  };

  const handleCompleteAll = async () => {
    const allDone = {};
    items.forEach((it) => { allDone[it.id] = true; });
    setCompletedItems(allDone);
    setSaving(true);
    try {
      const candId = user.candidate_id || '';
      const res = await request(`/api/onboarding/${candId}`, {
        method: 'PUT',
        token,
        body: { completed_items: allDone },
      });
      if (res) {
        setOnboarding(res);
        if (res.completed_items) setCompletedItems(res.completed_items);
      }
      setSuccessMsg('All items marked as complete!');
    } catch (err) {
      setError(err.message || 'Failed to save.');
      setCompletedItems(onboarding?.completed_items || {});
    } finally {
      setSaving(false);
    }
  };

  if (!user) return <Navigate to="/candidate/login" replace />;
  if (user.role !== 'Candidate') return <Navigate to="/" replace />;

  const categoryLabels = {
    equipment: { label: 'Equipment', icon: Laptop },
    software: { label: 'Software & Access', icon: Monitor },
    training: { label: 'Training & Compliance', icon: BookOpen },
    custom: { label: 'Additional Items', icon: ClipboardCheck },
  };

  const grouped = {};
  items.forEach((it) => {
    if (!grouped[it.category]) grouped[it.category] = [];
    grouped[it.category].push(it);
  });

  // Separate unread issue-resolved notifications
  const issueNotifications = notifications.filter((n) => !n.read && (n.type === 'issue.resolved' || n.title === 'Issue Resolved'));

  if (loading) {
    return (
      <div style={{ backgroundColor: '#ECECE9', fontFamily: "'Inter', sans-serif" }} className="min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-3 text-[14px] text-[#737373]">
          <Loader2 size={18} className="animate-spin" />
          Loading onboarding checklist...
        </div>
      </div>
    );
  }

  if (error === 'pending' && !onboarding) {
    return (
      <div style={{ backgroundColor: '#ECECE9', fontFamily: "'Inter', sans-serif" }} className="min-h-screen flex items-center justify-center">
        <div className="bg-white rounded-2xl border border-[#E2E2DC] p-8 max-w-md text-center">
          <div style={{ width: 48, height: 48, borderRadius: '50%', backgroundColor: '#FEF3C7' }} className="mx-auto mb-4 flex items-center justify-center">
            <Info size={22} className="text-[#F59E0B]" />
          </div>
          <p className="text-[14px] text-[#0A0A0A] font-semibold mb-1">Onboarding in progress</p>
          <p className="text-[12.5px] text-[#737373] mb-4 leading-relaxed">
            Your hiring manager is setting up your onboarding checklist. You'll gain full access once it's ready.
          </p>
          <button onClick={loadOnboarding} className="text-[13px] font-semibold text-[#0A0A0A] underline underline-offset-2">Check again</button>
        </div>
      </div>
    );
  }

  if (error && error !== 'pending' && !onboarding) {
    return (
      <div style={{ backgroundColor: '#ECECE9', fontFamily: "'Inter', sans-serif" }} className="min-h-screen flex items-center justify-center">
        <div className="bg-white rounded-2xl border border-[#E2E2DC] p-8 max-w-md text-center">
          <AlertCircle size={32} className="mx-auto mb-3 text-[#DC2626]" />
          <p className="text-[14px] text-[#0A0A0A] font-semibold mb-1">Unable to load onboarding</p>
          <p className="text-[12.5px] text-[#737373] mb-4">{error}</p>
          <button onClick={loadOnboarding} className="text-[13px] font-semibold text-[#0A0A0A] underline underline-offset-2">Try again</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: '#ECECE9', fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }} className="min-h-screen">
      <style>{`
        html, body, #root { background-color: #ECECE9 !important; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        .fade-up { animation: fadeUp .4s ease both; }
        .onboard-check { transition: all 0.2s ease; }
        .onboard-check:hover { background-color: #F5F5F2; }
      `}</style>

      {/* Top bar */}
      <div style={{ backgroundColor: '#FFFFFF', borderBottom: '1px solid #E2E2DC' }} className="sticky top-0 z-50">
        <div className="max-w-2xl mx-auto px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div style={{ width: 34, height: 34, borderRadius: '50%', backgroundColor: '#0A0A0A', color: '#FFFFFF' }}
              className="flex items-center justify-center font-bold text-[13px] shadow-sm">TJ</div>
            <div>
              <div className="text-[13.5px] font-bold text-[#0A0A0A] leading-tight">Term Jobs</div>
              <div className="text-[11px] text-[#737373]">Candidate Onboarding</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="px-3 py-1 rounded-full text-[10.5px] font-bold tracking-wider uppercase flex items-center gap-1.5"
              style={{ backgroundColor: isComplete ? '#ECFDF5' : '#FEF3C7', color: isComplete ? '#065F46' : '#92400E' }}>
              <span className={`w-1.5 h-1.5 rounded-full ${isComplete ? 'bg-[#10B981]' : 'bg-[#F59E0B]'}`} />
              {isComplete ? 'Complete' : 'In Progress'}
            </div>
            <button onClick={logout} title="Sign out" className="p-2 rounded-lg text-[#737373] hover:text-[#0A0A0A] hover:bg-[#F2F2EE] transition-colors">
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-5 py-6 space-y-4 fade-up">
        {/* Success banner */}
        {successMsg && (
          <div className="p-3.5 rounded-2xl text-[13px] font-medium flex items-center gap-2.5 bg-[#ECFDF5] border border-[#A7F3D0] text-[#065F46]">
            <CheckCircle2 size={16} />
            {successMsg}
          </div>
        )}

        {/* ─── Issue Resolved Notifications (inline on screen) ─── */}
        {issueNotifications.length > 0 && (
          <div className="space-y-2">
            {issueNotifications.map((n) => (
              <div key={n.id}
                className="p-4 rounded-2xl text-[13px] flex items-start gap-3 border"
                style={{ backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }}>
                <div style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: '#D1FAE5' }}
                  className="flex items-center justify-center shrink-0 mt-0.5">
                  <CheckCircle size={16} className="text-[#059669]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-bold text-[#065F46]">{n.title || 'Issue Resolved'}</span>
                    {n.timestamp_label && <span className="text-[10px] text-[#6B8A7E]">{n.timestamp_label}</span>}
                  </div>
                  <p className="text-[#065F46] leading-relaxed">{n.body || n.message || ''}</p>
                </div>
                <button onClick={() => handleDismissNotif(n.id)}
                  className="text-[#6B8A7E] hover:text-[#065F46] p-0.5 shrink-0">
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Hero card */}
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: 22, border: '1px solid #E2E2DC', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}
          className="p-7 md:p-8">
          <div className="text-[10.5px] font-bold tracking-[0.14em] uppercase text-[#8A8A85] mb-1.5">Onboarding Checklist</div>
          <h1 className="text-[1.5rem] md:text-[1.75rem] font-extrabold text-[#0A0A0A] tracking-tight leading-tight mb-2">
            Complete your onboarding
          </h1>
          <p className="text-[13px] text-[#5A5A57] leading-relaxed max-w-lg">
            Please review and acknowledge each item below. Once all required items are completed, you'll have full access to your workspace dashboard.
          </p>
          <div className="mt-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11.5px] font-semibold text-[#737373]">{completedCount} of {totalItems} items completed</span>
              <span className="text-[11.5px] font-bold text-[#0A0A0A]">{progressPct}%</span>
            </div>
            <div style={{ backgroundColor: '#F0F0EC', borderRadius: 999, height: 6 }} className="w-full overflow-hidden">
              <div style={{ backgroundColor: '#0A0A0A', borderRadius: 999, height: 6, width: `${progressPct}%`, transition: 'width 0.4s cubic-bezier(0.16, 1, 0.3, 1)' }} />
            </div>
          </div>
        </div>

        {/* Onboarding items grouped by category */}
        {Object.entries(grouped).map(([catKey, catItems]) => {
          const cat = categoryLabels[catKey] || { label: catKey, icon: ClipboardCheck };
          const CatIcon = cat.icon;
          const catCompleted = catItems.filter((it) => completedItems[it.id]).length;
          return (
            <div key={catKey} style={{ backgroundColor: '#FFFFFF', borderRadius: 20, border: '1px solid #E2E2DC', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }} className="overflow-hidden">
              <div className="px-6 py-4 border-b border-[#F0F0EC] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: '#F5F5F2' }} className="flex items-center justify-center">
                    <CatIcon size={15} strokeWidth={2.2} />
                  </div>
                  <div>
                    <div className="text-[13.5px] font-bold text-[#0A0A0A]">{cat.label}</div>
                    <div className="text-[11px] text-[#8A8A85]">{catCompleted} of {catItems.length} completed</div>
                  </div>
                </div>
                {catCompleted === catItems.length && catItems.length > 0 && <CheckCheck size={18} className="text-[#10B981]" />}
              </div>
              <div className="divide-y divide-[#F5F5F2]">
                {catItems.map((item) => {
                  const done = !!completedItems[item.id];
                  return (
                    <button key={item.id} onClick={() => handleToggle(item.id)} disabled={saving}
                      className="onboard-check w-full flex items-center gap-4 px-6 py-4 text-left disabled:opacity-50">
                      <div style={{
                        width: 24, height: 24, borderRadius: 8, border: done ? 'none' : '1.5px solid #D4D4CF',
                        backgroundColor: done ? '#0A0A0A' : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 0.2s ease', flexShrink: 0,
                      }}>
                        {done && <CheckCheck size={14} color="#FFFFFF" strokeWidth={2.5} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className={`text-[13px] font-medium ${done ? 'text-[#737373] line-through' : 'text-[#0A0A0A]'}`}>{item.label}</div>
                        {item.mandatory && !done && (
                          <div className="text-[10.5px] text-[#DC2626] font-semibold mt-0.5 flex items-center gap-1">
                            <Lock size={10} /> Mandatory
                          </div>
                        )}
                      </div>
                      {done && <span className="text-[11px] text-[#10B981] font-semibold shrink-0">Done</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}

        {totalItems === 0 && (
          <div style={{ backgroundColor: '#FFFFFF', borderRadius: 20, border: '1px solid #E2E2DC' }} className="p-8 text-center">
            <Info size={28} className="mx-auto mb-3 text-[#8A8A85]" />
            <p className="text-[14px] font-semibold text-[#0A0A0A] mb-1">No onboarding items yet</p>
            <p className="text-[12.5px] text-[#737373]">Your hiring manager is setting up your onboarding checklist. Check back soon.</p>
          </div>
        )}

        {/* Action buttons */}
        {totalItems > 0 && (
          <div className="flex items-center justify-between gap-3 pt-2 pb-8">
            {!isComplete ? (
              <button onClick={handleCompleteAll} disabled={saving}
                className="flex items-center gap-2 px-5 py-3 rounded-xl text-[13px] font-semibold transition-all disabled:opacity-50"
                style={{ backgroundColor: '#0A0A0A', color: '#FFFFFF', border: 'none', cursor: saving ? 'wait' : 'pointer' }}>
                <CheckCheck size={15} />
                Mark all as complete
              </button>
            ) : (
              <button onClick={() => navigate('/dashboard/candidate')} disabled={saving}
                className="flex items-center gap-2 px-5 py-3 rounded-xl text-[13px] font-semibold transition-all disabled:opacity-50"
                style={{ backgroundColor: '#0A0A0A', color: '#FFFFFF', border: 'none', cursor: 'pointer' }}>
                <CheckCircle2 size={15} />
                Go to Dashboard
                <ArrowRight size={14} />
              </button>
            )}
            {!isComplete && (
              <div className="text-[11.5px] text-[#8A8A85] font-medium">
                Complete all items to proceed
              </div>
            )}
          </div>
        )}

        {/* Raise Issue button */}
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: 20, border: '1px solid #E2E2DC', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}
          className="px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#FEF2F2' }} className="flex items-center justify-center">
              <Flag size={16} className="text-[#DC2626]" />
            </div>
            <div>
              <div className="text-[13px] font-bold text-[#0A0A0A]">Facing an issue?</div>
              <div className="text-[11.5px] text-[#737373]">Report a problem with hardware, access, or onboarding</div>
            </div>
          </div>
          <button onClick={() => setShowIssueModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[12.5px] font-semibold bg-[#0A0A0A] text-white hover:bg-[#1A1A1A] transition-colors">
            <Flag size={13} />
            Raise Issue
          </button>
        </div>
      </div>

      {/* ============================================================
          RAISE ISSUE MODAL
         ============================================================ */}
      {showIssueModal && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4" onClick={() => setShowIssueModal(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl border border-[#E2E2DC] shadow-2xl w-full max-w-md p-6 space-y-5 fade-up"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-[15px] font-bold text-[#0A0A0A]">Raise an Issue</h3>
                <p className="text-[11.5px] text-[#737373] mt-0.5">Describe the problem and your hiring manager will resolve it.</p>
              </div>
              <button onClick={() => setShowIssueModal(false)} className="text-[#8A8A85] hover:text-[#0A0A0A] p-1">
                <X size={18} />
              </button>
            </div>

            {/* Category grid */}
            <div>
              <label className="text-[11px] font-bold tracking-wider uppercase text-[#6B6B67] mb-2 block">Category</label>
              <div className="grid grid-cols-2 gap-2">
                {ISSUE_CATEGORIES.map((cat) => {
                  const Icon = cat.icon;
                  const selected = issueCategory === cat.id;
                  return (
                    <button key={cat.id} onClick={() => setIssueCategory(cat.id)}
                      style={{
                        backgroundColor: selected ? '#0A0A0A' : '#FAFAFA',
                        color: selected ? '#FFFFFF' : '#0A0A0A',
                        border: selected ? '1px solid #0A0A0A' : '1px solid #E2E2DC',
                      }}
                      className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-[12px] font-medium text-left transition-all hover:shadow-sm">
                      <Icon size={14} strokeWidth={2} />
                      {cat.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="text-[11px] font-bold tracking-wider uppercase text-[#6B6B67] mb-2 block">Description</label>
              <textarea
                value={issueDescription}
                onChange={(e) => setIssueDescription(e.target.value)}
                placeholder="Briefly describe what's wrong..."
                rows={3}
                className="w-full px-4 py-3 rounded-xl border border-[#E2E2DC] bg-[#FAFAFA] text-[13px] text-[#0A0A0A] placeholder:text-[#B5B4AE] outline-none focus:border-[#0A0A0A] focus:bg-white transition-colors resize-none"
              />
            </div>

            {/* Submit */}
            <div className="flex items-center justify-end gap-2 pt-1">
              <button onClick={() => setShowIssueModal(false)}
                className="px-4 py-2.5 rounded-xl text-[12.5px] font-semibold text-[#737373] hover:bg-[#F5F5F2] transition-colors">
                Cancel
              </button>
              <button
                onClick={handleSubmitIssue}
                disabled={!issueCategory || !issueDescription.trim() || submittingIssue}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[12.5px] font-semibold bg-[#0A0A0A] text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#1A1A1A] transition-colors"
              >
                {submittingIssue ? <Loader2 size={14} className="animate-spin" /> : <Send size={13} />}
                {submittingIssue ? 'Submitting...' : 'Submit Issue'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
