import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { request } from '../../api/client';
import {
  Bell, ShieldCheck, ClipboardList, Building2, Briefcase,
  Hash, LogOut, LayoutGrid, Check, Lock, Flag,
} from 'lucide-react';

const SECTION_ICONS = { equipment: '💻', software: '🔑', training: '🎓' };

export default function CandidatePortal() {
  const { user, token, logout } = useAuth();
  const [checklist, setChecklist] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submission, setSubmission] = useState(null);
  const [showRaiseIssue, setShowRaiseIssue] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);

  if (!user) return <Navigate to="/candidate/login" replace />;
  if (user.role !== 'Candidate') return <Navigate to="/" replace />;

  const candidateId = user.candidate_id || '';
  const unreadNotifs = notifications.filter((n) => !n.read);

  useEffect(() => {
    if (!candidateId) { setLoading(false); return; }
    Promise.all([
      request(`/api/onboarding/${candidateId}`, { token }).catch(() => null),
      request('/candidates?status=Accepted', { token }).catch(() => []),
      request(`/api/onboarding/notifications/${candidateId}`, { token }).catch(() => []),
    ])
      .then(([obData, cands, notifs]) => {
        setChecklist(obData);
        const allCands = Array.isArray(cands) ? cands : cands?.candidates || [];
        const my = allCands.find((c) => (c.submission_id || c.id) === candidateId);
        if (my) setSubmission(my);
        setNotifications(Array.isArray(notifs) ? notifs : []);
      })
      .catch(() => setChecklist(null))
      .finally(() => setLoading(false));
  }, [candidateId, token]);

  const toggleItem = async (itemId) => {
    if (!checklist || saving) return;
    setSaving(true);
    const prev = checklist.completed_items || {};
    const newVal = !prev[itemId];
    const newCompleted = { ...prev, [itemId]: newVal };
    // Optimistic update
    setChecklist({ ...checklist, completed_items: newCompleted });
    try {
      const updated = await request(`/api/onboarding/${candidateId}`, {
        method: 'PUT', token, body: { completed_items: newCompleted },
      });
      if (updated && updated.completed_items) {
        setChecklist(updated);
      }
    } catch (err) {
      // Revert on error
      setChecklist({ ...checklist, completed_items: prev });
      console.error('Toggle failed:', err);
    } finally {
      setSaving(false);
    }
  };

  const getRequiredItems = () => {
    if (!checklist) return [];
    const items = [];
    if (checklist.laptop_required) items.push({ id: 'laptop', label: `Company laptop (${checklist.laptop_spec || 'Standard build'})`, section: 'equipment' });
    if (checklist.badge_required) items.push({ id: 'badge', label: 'Building badge / on-site access', section: 'equipment' });
    (checklist.software || []).forEach((s) => { if (s.enabled) items.push({ id: s.id, label: s.label, section: 'software', note: s.note }); });
    (checklist.training || []).forEach((t) => { if (t.enabled) items.push({ id: t.id, label: t.label, section: 'training', mandatory: t.mandatory, note: t.note }); });
    (checklist.custom_items || []).forEach((ci) => { if (ci.enabled) items.push({ id: ci.id, label: ci.label, section: ci.section, custom: true, note: ci.note }); });
    return items;
  };

  const markNotifRead = async (notifId) => {
    setNotifications((prev) => prev.map((n) => n.id === notifId ? { ...n, read: true } : n));
    try {
      await request(`/api/onboarding/notifications/${notifId}/read`, { method: 'POST', token });
    } catch (_) {}
  };

  const requiredItems = getRequiredItems();
  const completedCount = requiredItems.filter((item) => checklist?.completed_items?.[item.id]).length;
  const totalRequired = requiredItems.length;
  const progress = totalRequired > 0 ? Math.round((completedCount / totalRequired) * 100) : 0;
  const isComplete = checklist?.status === 'completed' || (totalRequired > 0 && completedCount === totalRequired);

  const grouped = {};
  requiredItems.forEach((item) => { if (!grouped[item.section]) grouped[item.section] = []; grouped[item.section].push(item); });

  const companyName = checklist?.company_name || submission?.company_name || user.tenant_name || 'Company';
  const vendorName = checklist?.vendor_name || submission?.vendor_name || 'Vendor';

  if (loading) {
    return (
      <div style={{ fontFamily: "'Inter', sans-serif" }} className="min-h-screen w-full flex items-center justify-center bg-[#F7F7F5]">
        <div className="text-[14px] text-[#8A8A87]">Loading...</div>
      </div>
    );
  }

  // ─── No checklist at all ───
  if (!checklist) {
    return (
      <div style={{ fontFamily: "'Inter', sans-serif" }} className="min-h-screen w-full flex bg-[#F7F7F5]">
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');`}</style>
        <aside className="w-[260px] shrink-0 bg-white border-r border-[#EDECE7] flex flex-col justify-between max-lg:hidden">
          <div>
            <div className="flex items-center gap-3 px-6 py-6 border-b border-[#EDECE7]">
              <div className="w-9 h-9 rounded-xl bg-[#0A0A0A] text-white flex items-center justify-center font-bold text-[14px]">TJ</div>
              <div>
                <div className="text-[14.5px] font-semibold text-[#0A0A0A] leading-tight">Term Jobs</div>
                <div className="text-[12px] text-[#8A8A87]">Candidate Portal</div>
              </div>
            </div>
            <div className="px-6 pt-6">
              <span className="text-[10.5px] tracking-[0.14em] uppercase text-[#A6A59F]">Workspace</span>
              <div className="mt-3">
                <div className="flex items-center gap-2.5 text-[14px] font-medium text-[#0A0A0A] bg-[#F1F0EC] rounded-lg px-3 py-2.5">
                  <LayoutGrid size={15} strokeWidth={2} /> Dashboard
                </div>
              </div>
              <div className="mt-2">
                <button onClick={() => setShowRaiseIssue(true)} className="w-full flex items-center gap-2.5 text-[14px] font-medium text-[#6B6B67] rounded-lg px-3 py-2.5 hover:bg-[#F1F0EC] transition-colors text-left">
                  <Flag size={15} strokeWidth={2} /> Raise Issue
                </button>
              </div>
            </div>
          </div>
          <div className="px-6 py-5 border-t border-[#EDECE7]">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-full bg-[#EEF0FF] text-[#0A0A0A] flex items-center justify-center text-[13px] font-semibold">
                {(user.name || 'C')[0].toUpperCase()}
              </div>
              <div>
                <div className="text-[13.5px] font-medium text-[#0A0A0A] leading-tight">{user.name}</div>
                <div className="text-[12px] text-[#8A8A87]">Candidate</div>
              </div>
            </div>
            <button onClick={logout} className="w-full flex items-center justify-center gap-2 text-[13px] font-medium text-[#3A3A37] border border-[#D9D8D2] rounded-lg py-2.5 hover:bg-[#F7F7F5] transition-colors">
              <LogOut size={13} strokeWidth={2} /> Sign out
            </button>
          </div>
        </aside>
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex items-center justify-between px-8 py-5 bg-white border-b border-[#EDECE7] max-lg:px-5">
            <div className="flex items-center gap-1.5 text-[13.5px]">
              <span className="font-semibold text-[#0A0A0A]">{companyName.toLowerCase()}</span>
              <span className="text-[#B5B4AE]">/</span>
              <span className="text-[#6B6B67]">Dashboard</span>
            </div>
          </div>
          <div className="flex-1 px-8 py-8 max-lg:px-5">
            <div className="bg-white border border-[#EDECE7] rounded-2xl px-6 sm:px-7 py-5 mb-6 flex flex-wrap gap-x-10 gap-y-4">
              <SummaryItem icon={Hash} label="Candidate ID" value={candidateId || '—'} />
              <SummaryItem icon={Briefcase} label="Vendor" value={vendorName} />
              <SummaryItem icon={Building2} label="Company" value={companyName} />
            </div>
            <div className="flex items-center justify-center py-20">
              <div className="w-full max-w-[420px] text-center">
                <div className="w-14 h-14 rounded-2xl bg-[#F1F0EC] flex items-center justify-center mx-auto mb-6">
                  <ClipboardList size={24} strokeWidth={1.75} color="#8A8A87" />
                </div>
                <h1 className="text-[19px] font-semibold text-[#0A0A0A] mb-2">No onboarding setup yet</h1>
                <p className="text-[14px] text-[#6B6B67] leading-relaxed">
                  Your hiring manager hasn't set up your onboarding checklist yet for <span className="text-[#0A0A0A] font-medium">{companyName}</span>. Please check back later.
                </p>
                <p className="text-[12.5px] text-[#A6A59F] mt-4">Candidate ID {candidateId} · via {vendorName}</p>
                <div className="mt-6">
                  <button
                    onClick={() => setShowRaiseIssue(true)}
                    className="inline-flex items-center gap-2 text-[13px] font-medium text-[#0A0A0A] bg-white border border-[#EDECE7] rounded-full px-5 py-2.5 hover:bg-[#F7F7F5] shadow-sm transition-colors cursor-pointer"
                  >
                    <Flag size={14} strokeWidth={2} className="text-[#D97706]" />
                    Raise Issue — checklist missing?
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
        {showRaiseIssue && <RaiseIssueModal onClose={() => setShowRaiseIssue(false)} candidateId={candidateId} candidateName={user.name} companyName={companyName} vendorName={vendorName} tenantId={user.tenant_id} token={token} />}
      </div>
    );
  }

  // ─── Main layout ───
  return (
    <div style={{ fontFamily: "'Inter', sans-serif" }} className="min-h-screen w-full flex bg-[#F7F7F5]">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
        html, body, #root { height: 100%; margin: 0; }
        @keyframes fade-up { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .fade-up { animation: fade-up .45s ease both; }
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        .fade-in { animation: fade-in .3s ease both; }
      `}</style>

      {/* ─── Sidebar ─── */}
      <aside className="w-[260px] shrink-0 bg-white border-r border-[#EDECE7] flex flex-col justify-between max-lg:hidden">
        <div>
          <div className="flex items-center gap-3 px-6 py-6 border-b border-[#EDECE7]">
            <div className="w-9 h-9 rounded-xl bg-[#0A0A0A] text-white flex items-center justify-center font-bold text-[14px]">TJ</div>
            <div>
              <div className="text-[14.5px] font-semibold text-[#0A0A0A] leading-tight">Term Jobs</div>
              <div className="text-[12px] text-[#8A8A87]">Candidate Portal</div>
            </div>
          </div>
          <div className="px-6 pt-6">
            <span className="text-[10.5px] tracking-[0.14em] uppercase text-[#A6A59F]">Workspace</span>
            <div className="mt-3">
              <div className="flex items-center gap-2.5 text-[14px] font-medium text-[#0A0A0A] bg-[#F1F0EC] rounded-lg px-3 py-2.5">
                <LayoutGrid size={15} strokeWidth={2} /> Dashboard
              </div>
            </div>
            <div className="mt-2">
              <button onClick={() => setShowRaiseIssue(true)} className="w-full flex items-center gap-2.5 text-[14px] font-medium text-[#6B6B67] rounded-lg px-3 py-2.5 hover:bg-[#F1F0EC] transition-colors text-left">
                <Flag size={15} strokeWidth={2} /> Raise Issue
              </button>
            </div>
          </div>
        </div>
        <div className="px-6 py-5 border-t border-[#EDECE7]">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-8 h-8 rounded-full bg-[#EEF0FF] text-[#0A0A0A] flex items-center justify-center text-[13px] font-semibold">
              {(user.name || 'C')[0].toUpperCase()}
            </div>
            <div>
              <div className="text-[13.5px] font-medium text-[#0A0A0A] leading-tight">{user.name}</div>
              <div className="text-[12px] text-[#8A8A87]">Candidate</div>
            </div>
          </div>
          <button onClick={logout} className="w-full flex items-center justify-center gap-2 text-[13px] font-medium text-[#3A3A37] border border-[#D9D8D2] rounded-lg py-2.5 hover:bg-[#F7F7F5] transition-colors">
            <LogOut size={13} strokeWidth={2} /> Sign out
          </button>
        </div>
      </aside>

      {/* ─── Main ─── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* topbar */}
        <div className="flex items-center justify-between px-8 py-5 bg-white border-b border-[#EDECE7] max-lg:px-5">
          <div className="flex items-center gap-1.5 text-[13.5px]">
            <span className="font-semibold text-[#0A0A0A]">{companyName.toLowerCase()}</span>
            <span className="text-[#B5B4AE]">/</span>
            <span className="text-[#6B6B67]">Dashboard</span>
            <span className="text-[#B5B4AE]">·</span>
            <span className="text-[#6B6B67]">Candidate</span>
          </div>
          <div className="flex items-center gap-3">
            <button className="w-9 h-9 rounded-full border border-[#EDECE7] flex items-center justify-center text-[#6B6B67] hover:bg-[#F7F7F5] transition-colors">
              <Bell size={15} strokeWidth={2} />
            </button>
            <span className={`inline-flex items-center gap-1.5 text-[12.5px] font-medium rounded-full px-3 py-1.5 ${isComplete ? 'text-[#1E7A43] bg-[#E9F6EE] border border-[#BFE3CC]' : 'text-[#92400E] bg-[#FEF3C7] border border-[#FDE68A]'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isComplete ? 'bg-[#1E7A43]' : 'bg-[#D97706]'}`} />
              {isComplete ? 'Verified session' : 'Pending onboarding'}
            </span>
          </div>
        </div>

        {/* content */}
        <div className="flex-1 px-8 py-8 max-lg:px-5 max-lg:py-6">
          {/* summary strip */}
          <div className="fade-up bg-white border border-[#EDECE7] rounded-2xl px-6 sm:px-7 py-5 mb-6 flex flex-wrap gap-x-10 gap-y-4">
            <SummaryItem icon={Hash} label="Candidate ID" value={candidateId || '—'} />
            <SummaryItem icon={Briefcase} label="Vendor" value={vendorName} />
            <SummaryItem icon={Building2} label="Company" value={companyName} />
          </div>

          {/* ─── Dashboard (only when complete) ─── */}
          {isComplete && (
            <div className="fade-up">
              <div className="bg-white border border-[#EDECE7] rounded-2xl px-6 sm:px-7 py-5 mb-6 text-center">
                <div className="w-14 h-14 rounded-2xl bg-[#E9F6EE] flex items-center justify-center mx-auto mb-4">
                  <ShieldCheck size={24} strokeWidth={1.75} color="#1E7A43" />
                </div>
                <h2 className="text-[18px] font-semibold text-[#0A0A0A] mb-1">Onboarding Complete</h2>
                <p className="text-[13.5px] text-[#6B6B67]">All onboarding items completed. Welcome aboard.</p>
              </div>
              <h3 className="text-[14px] font-semibold text-[#0A0A0A] mb-4">Your Profile</h3>
              <div className="bg-white border border-[#EDECE7] rounded-2xl px-6 sm:px-7 py-5">
                {[
                  ['Candidate Name', user.name],
                  ['Email', user.email],
                  ['Candidate ID', candidateId || '—'],
                  ['Requisition', checklist?.requisition_title || '—'],
                  ['Company', companyName],
                  ['Vendor', vendorName],
                  ['Status', 'Active & Verified'],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between py-3 border-b border-[#F1F0EC] last:border-b-0">
                    <span className="text-[13px] text-[#8A8A87]">{label}</span>
                    <span className="text-[14px] font-medium text-[#0A0A0A]">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          MANDATORY ONBOARDING POPUP — cannot be closed until complete
         ═══════════════════════════════════════════════════════════════ */}
      {checklist && !isComplete && (
        <div
          className="fade-in"
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(247, 247, 245, 0.97)',
            backdropFilter: 'blur(8px)',
            overflow: 'auto',
          }}
        >
          <div style={{ maxWidth: 560, margin: '0 auto', padding: '32px 20px 48px' }}>
            {/* Header */}
            <div className="text-center mb-8">
              <div className="w-14 h-14 rounded-2xl bg-[#0A0A0A] flex items-center justify-center mx-auto mb-5">
                <ClipboardList size={24} strokeWidth={1.75} color="#fff" />
              </div>
              <h1 className="text-[22px] font-bold text-[#0A0A0A] mb-2">Complete Your Onboarding</h1>
              <p className="text-[14px] text-[#6B6B67] leading-relaxed max-w-[400px] mx-auto">
                Please review and complete all onboarding items assigned by your hiring manager to access your dashboard.
              </p>
              <div className="flex items-center justify-center gap-2 mt-4">
                <span className="text-[13px] font-semibold text-[#0A0A0A]">{completedCount}/{totalRequired}</span>
                <span className="text-[13px] text-[#8A8A87]">items completed</span>
              </div>
              {/* progress bar */}
              <div className="mt-3 max-w-[300px] mx-auto">
                <div className="h-1.5 bg-[#EDECE7] rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-300" style={{ width: `${progress}%`, background: '#0A0A0A' }} />
                </div>
              </div>
            </div>

            {/* Checklist sections */}
            {Object.entries(grouped).map(([section, items]) => (
              <div key={section} className="bg-white border border-[#EDECE7] rounded-2xl px-5 sm:px-6 py-5 mb-4">
                <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-[#F1F0EC]">
                  <span className="text-[15px]">{SECTION_ICONS[section] || '📌'}</span>
                  <h3 className="text-[14.5px] font-semibold text-[#0A0A0A] capitalize">{section}</h3>
                </div>
                {items.map((item) => {
                  const done = !!checklist.completed_items?.[item.id];
                  return (
                    <div
                      key={item.id}
                      onClick={() => toggleItem(item.id)}
                      className="flex items-center gap-3 py-3 border-b border-[#F1F0EC] last:border-b-0 cursor-pointer group"
                      style={{ opacity: saving ? 0.6 : 1, pointerEvents: saving ? 'none' : 'auto' }}
                    >
                      <div
                        className="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all duration-200"
                        style={{ borderColor: done ? '#0A0A0A' : '#D9D8D2', background: done ? '#0A0A0A' : 'transparent' }}
                      >
                        {done && <Check size={11} color="#fff" strokeWidth={3} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[14px] text-[#0A0A0A] font-medium" style={{ textDecoration: done ? 'line-through' : 'none', opacity: done ? 0.5 : 1 }}>
                          {item.label}
                        </div>
                        {item.note && <div className="text-[12px] text-[#A6A59F] mt-0.5">{item.note}</div>}
                      </div>
                      {item.mandatory && (
                        <span className="text-[10px] tracking-[0.04em] uppercase text-[#8A8A87] bg-[#F1F0EC] border border-[#EDECE7] rounded-full px-2 py-0.5 font-medium shrink-0">
                          Required
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}

            {/* Notifications */}
            {notifications.length > 0 && (
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-3">
                  <Bell size={14} className="text-[#0A0A0A]" />
                  <span className="text-[13px] font-semibold text-[#0A0A0A]">Updates from your hiring manager</span>
                  {unreadNotifs.length > 0 && (
                    <span className="text-[11px] font-bold text-white bg-[#DC2626] rounded-full px-2 py-0.5 leading-none">{unreadNotifs.length}</span>
                  )}
                </div>
                <div className="space-y-2">
                  {notifications.slice(0, 5).map((n) => (
                    <div
                      key={n.id}
                      onClick={() => markNotifRead(n.id)}
                      className="bg-white border rounded-xl px-4 py-3 cursor-pointer transition-colors"
                      style={{ borderColor: n.read ? '#EDECE7' : '#93C5FD', background: n.read ? '#fff' : '#F0F9FF' }}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[13px] font-semibold text-[#0A0A0A]">{n.title}</span>
                        {!n.read && <span className="w-2 h-2 rounded-full bg-[#2563EB] shrink-0" />}
                      </div>
                      <p className="text-[12.5px] text-[#6B6B67] leading-relaxed m-0">{n.body}</p>
                      <span className="text-[11px] text-[#A6A59F] mt-1 block">{n.created_at ? new Date(n.created_at).toLocaleString() : ''}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="mt-6 flex flex-col items-center gap-3">
              <div className="inline-flex items-center gap-2 text-[13px] text-[#8A8A87] bg-white border border-[#EDECE7] rounded-full px-5 py-2.5">
                <Lock size={12} strokeWidth={2} />
                Complete all items above to unlock your dashboard
              </div>
              <button
                onClick={() => setShowRaiseIssue(true)}
                className="inline-flex items-center gap-2 text-[13px] font-medium text-[#6B6B67] bg-white border border-[#EDECE7] rounded-full px-5 py-2.5 hover:bg-[#F7F7F5] hover:text-[#0A0A0A] transition-colors cursor-pointer"
              >
                <Flag size={13} strokeWidth={2} />
                Raise Issue — access not provided?
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          RAISE ISSUE MODAL
         ═══════════════════════════════════════════════════════════════ */}
      {showRaiseIssue && <RaiseIssueModal onClose={() => setShowRaiseIssue(false)} candidateId={candidateId} companyName={companyName} token={token} />}
    </div>
  );
}


function RaiseIssueModal({ onClose, candidateId, candidateName, companyName, vendorName, tenantId, token }) {
  const [category, setCategory] = useState('access');
  const [description, setDescription] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const CATEGORIES = [
    { value: 'access', label: 'Access not provided', desc: 'VPN, email, GitHub, Slack or system access missing' },
    { value: 'equipment', label: 'Equipment not received', desc: 'Laptop, badge or other equipment not delivered' },
    { value: 'training', label: 'Training issue', desc: 'Problem with onboarding training or compliance' },
    { value: 'relocation', label: 'Relocation / logistics', desc: 'Travel, accommodation or relocation support' },
    { value: 'other', label: 'Other', desc: 'Any other onboarding issue' },
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg('');
    try {
      const selectedCat = CATEGORIES.find((c) => c.value === category);
      const result = await request('/api/onboarding/issues', {
        method: 'POST',
        token,
        body: {
          candidate_id: candidateId,
          candidate_name: candidateName || candidateId,
          company_name: companyName,
          vendor_name: vendorName || '',
          tenant_id: tenantId || '',
          category,
          category_label: selectedCat?.label || 'Onboarding Issue',
          description,
        },
      });
      if (result && result.id) {
        setSubmitted(true);
      } else {
        setErrorMsg('Server returned unexpected response. Please try again.');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Failed to submit issue. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}>
      <div style={{ background: '#fff', borderRadius: 16, width: '90%', maxWidth: 480, boxShadow: '0 25px 60px rgba(0,0,0,0.25)' }} className="fade-in">
        {!submitted ? (
          <form onSubmit={handleSubmit}>
            <div style={{ padding: '24px 28px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Flag size={18} color="#92400E" />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0A0A0A', margin: 0 }}>Raise Issue</h3>
                    <p style={{ fontSize: '0.75rem', color: '#8A8A87', margin: 0 }}>Report an onboarding problem</p>
                  </div>
                </div>
                <button type="button" onClick={onClose} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #EDECE7', background: '#fff', color: '#6B6B67', fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
              </div>
            </div>
            <div style={{ padding: '0 28px 24px' }}>
              <label style={{ display: 'block', marginBottom: 16 }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#3A3A37', display: 'block', marginBottom: 8 }}>Issue type</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {CATEGORIES.map((cat) => (
                    <div
                      key={cat.value}
                      onClick={() => setCategory(cat.value)}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8, border: `1px solid ${category === cat.value ? '#0A0A0A' : '#EDECE7'}`, background: category === cat.value ? '#F7F7F5' : '#fff', cursor: 'pointer', transition: 'all 0.15s' }}
                    >
                      <div style={{ width: 16, height: 16, borderRadius: '50%', border: `2px solid ${category === cat.value ? '#0A0A0A' : '#D9D8D2'}`, background: category === cat.value ? '#0A0A0A' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {category === cat.value && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} />}
                      </div>
                      <div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#0A0A0A' }}>{cat.label}</div>
                        <div style={{ fontSize: '0.72rem', color: '#8A8A87' }}>{cat.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </label>
              <label style={{ display: 'block', marginBottom: 20 }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#3A3A37', display: 'block', marginBottom: 6 }}>Description</span>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                  rows={4}
                  placeholder="Describe the issue in detail..."
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #EDECE7', fontSize: '0.85rem', resize: 'vertical', fontFamily: 'inherit', outline: 'none' }}
                />
              </label>
              {errorMsg && (
                <div style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', fontSize: '0.8rem', fontWeight: 600, marginBottom: 12 }}>
                  {errorMsg}
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, paddingBottom: 4 }}>
                <button type="button" onClick={onClose} style={{ flex: 1, padding: '10px 0', borderRadius: 8, border: '1px solid #EDECE7', background: '#fff', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', color: '#6B6B67', fontFamily: 'inherit' }}>Cancel</button>
                <button type="submit" disabled={submitting || !description.trim()} style={{ flex: 1, padding: '10px 0', borderRadius: 8, border: 'none', background: '#0A0A0A', color: '#fff', fontSize: '0.85rem', fontWeight: 700, cursor: submitting ? 'wait' : 'pointer', opacity: submitting || !description.trim() ? 0.5 : 1, fontFamily: 'inherit' }}>
                  {submitting ? 'Sending...' : 'Submit Issue'}
                </button>
              </div>
            </div>
          </form>
        ) : (
          <div style={{ padding: '36px 28px', textAlign: 'center' }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: '#E9F6EE', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <Check size={24} color="#1E7A43" />
            </div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0A0A0A', marginBottom: 6 }}>Issue Submitted</h3>
            <p style={{ fontSize: '0.85rem', color: '#6B6B67', lineHeight: 1.5, marginBottom: 20 }}>
              Your issue has been reported. Your hiring manager will be notified and follow up shortly.
            </p>
            <button onClick={onClose} style={{ padding: '10px 32px', borderRadius: 8, border: 'none', background: '#0A0A0A', color: '#fff', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryItem({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-8 h-8 rounded-lg bg-[#F7F7F5] flex items-center justify-center shrink-0">
        <Icon size={14} strokeWidth={2} color="#6B6B67" />
      </span>
      <div>
        <div className="text-[11px] tracking-[0.06em] uppercase text-[#A6A59F]">{label}</div>
        <div className="text-[14px] font-medium text-[#0A0A0A] mt-0.5" style={{ fontFamily: label === 'Candidate ID' ? "'JetBrains Mono', monospace" : 'inherit' }}>
          {value}
        </div>
      </div>
    </div>
  );
}
