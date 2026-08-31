import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { request } from '../../api/client';
import {
  X, User, Mail, MapPin, Calendar, Clock, Briefcase, Shield,
  TrendingUp, AlertCircle, CheckCircle, FileText, DollarSign,
  ChevronRight, BarChart3, Users as UsersIcon, Building
} from 'lucide-react';

export default function CandidateDetailPanel({ candidateId, onClose }) {
  const { token } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!candidateId) return;
    setLoading(true);
    setError('');
    setData(null);
    request(`/api/workforce/team/${candidateId}`, { token })
      .then((res) => { setData(res); setLoading(false); })
      .catch((err) => { setError(err.message || 'Failed to load'); setLoading(false); });
  }, [candidateId, token]);

  if (!candidateId) return null;

  const wo = data?.work_order || {};
  const cand = data?.candidate || {};
  const ob = data?.onboarding || {};
  const ts = data?.timesheets || {};
  const tsSummary = ts?.summary || {};
  const graphData = ts?.graph || [];
  const issues = data?.issues || {};
  const expenses = data?.expenses || {};
  const notifs = data?.notifications || [];

  // --- Color helpers ---
  const statusColor = (s) => {
    if (s === 'ACTIVE') return { bg: '#dcfce7', text: '#166534', dot: '#22c55e' };
    if (s === 'ONBOARDING') return { bg: '#fef3c7', text: '#92400e', dot: '#f59e0b' };
    if (s === 'COMPLETED') return { bg: '#dbeafe', text: '#1e40af', dot: '#3b82f6' };
    return { bg: '#f3f4f6', text: '#374151', dot: '#9ca3af' };
  };
  const tsColor = (s) => {
    if (s === 'APPROVED') return { bg: '#dcfce7', text: '#166534' };
    if (s === 'SUBMITTED') return { bg: '#fef3c7', text: '#92400e' };
    if (s === 'REJECTED') return { bg: '#fee2e2', text: '#991b1b' };
    if (s === 'DRAFT') return { bg: '#f3f4f6', text: '#6b7280' };
    return { bg: '#f3f4f6', text: '#6b7280' };
  };

  // --- Graph: find max hours for scaling ---
  const maxHours = useMemo(() => {
    if (graphData.length === 0) return 40;
    return Math.max(40, ...graphData.map((d) => d.hours));
  }, [graphData]);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed top-0 right-0 h-full w-full max-w-[560px] bg-[#f7f7f5] shadow-2xl z-50 overflow-y-auto animate-slide-in">
        {/* Header */}
        <div className="bg-[#1a1a1a] text-white px-6 py-5 sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-[15px] font-bold">
                {(cand.name || 'C').split(' ').map(w => w[0]).join('').slice(0, 2)}
              </div>
              <div>
                <h2 className="text-[1.1rem] font-bold tracking-tight">{cand.name || 'Candidate'}</h2>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[11px] font-mono text-[#a0a09a]">{candidateId}</span>
                  {wo.status && (
                    <span
                      className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                      style={{ backgroundColor: statusColor(wo.status).bg, color: statusColor(wo.status).text }}
                    >
                      {wo.status}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center hover:bg-white/20 transition"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-[13px] text-[#8a8a85]">Loading candidate details...</div>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 gap-2">
            <AlertCircle size={28} className="text-[#dc2626]" />
            <div className="text-[13px] text-[#dc2626]">{error}</div>
            <button onClick={onClose} className="text-[12px] text-[#1a1a1a] underline mt-1">Close</button>
          </div>
        ) : (
          <div className="p-6 space-y-5">

            {/* ── Section 1: Contact & Basic Info ── */}
            <Section title="Contact Information">
              <div className="grid grid-cols-2 gap-3">
                <InfoRow icon={<Mail size={13} />} label="Email" value={cand.email || '—'} />
                <InfoRow icon={<MapPin size={13} />} label="Location" value={wo.location || '—'} />
                <InfoRow icon={<Building size={13} />} label="Company" value={wo.company_name || '—'} />
                <InfoRow icon={<UsersIcon size={13} />} label="Vendor" value={wo.vendor_name || '—'} />
              </div>
            </Section>

            {/* ── Section 2: Assignment Details ── */}
            <Section title="Assignment Details">
              <div className="grid grid-cols-2 gap-3">
                <InfoRow icon={<Briefcase size={13} />} label="Role" value={wo.requisition_title || '—'} />
                <InfoRow icon={<FileText size={13} />} label="Work Order" value={wo.work_order_number || '—'} mono />
                <InfoRow icon={<Calendar size={13} />} label="Start Date" value={wo.start_date || '—'} />
                <InfoRow icon={<Calendar size={13} />} label="End Date" value={wo.end_date || '—'} />
                <InfoRow icon={<MapPin size={13} />} label="Work Arrangement" value={wo.work_arrangement || '—'} />
                <InfoRow icon={<Shield size={13} />} label="Engagement" value={wo.engagement_type || '—'} />
                <InfoRow icon={<Clock size={13} />} label="Weekly Hours" value={`${wo.weekly_hours || 40}h`} />
                <InfoRow icon={<User size={13} />} label="Reporting Manager" value={wo.reporting_manager || '—'} />
              </div>
              {wo.overtime_policy && (
                <div className="mt-3 p-3 bg-white rounded-lg border border-[#eaeae6]">
                  <div className="text-[10px] uppercase tracking-wider text-[#8a8a85] font-semibold mb-1">Overtime Policy</div>
                  <div className="text-[12.5px] text-[#1a1a1a]">{wo.overtime_policy}</div>
                </div>
              )}
            </Section>

            {/* ── Section 3: Weekly Hours Graph ── */}
            {graphData.length > 0 && (
              <Section title="Weekly Hours Trend">
                <div className="bg-white rounded-lg border border-[#eaeae6] p-4">
                  {/* Y-axis labels + bars */}
                  <div className="flex items-end gap-1.5" style={{ height: 140 }}>
                    {graphData.map((d, i) => {
                      const regularPct = maxHours > 0 ? (d.regular / maxHours) * 100 : 0;
                      const otPct = maxHours > 0 ? (d.overtime / maxHours) * 100 : 0;
                      const totalPct = regularPct + otPct;
                      const expectedPct = (40 / maxHours) * 100;
                      return (
                        <div key={i} className="flex-1 flex flex-col items-center gap-1 relative group">
                          {/* Tooltip */}
                          <div className="absolute -top-16 left-1/2 -translate-x-1/2 bg-[#1a1a1a] text-white text-[10px] px-2.5 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10 shadow-lg">
                            <div className="font-bold">{d.hours}h total</div>
                            <div className="text-[#a0a09a]">{d.regular}h regular · {d.overtime}h OT</div>
                            <div className="text-[#a0a09a]">{d.period_label || d.week}</div>
                          </div>
                          {/* Bar */}
                          <div className="w-full flex flex-col justify-end" style={{ height: 120 }}>
                            {/* Expected line */}
                            <div
                              className="absolute left-0 right-0 border-t border-dashed border-[#d1d5cc]"
                              style={{ bottom: `${expectedPct}%` }}
                            />
                            <div className="w-full relative rounded-t-sm overflow-hidden" style={{ height: `${Math.max(totalPct, 2)}%` }}>
                              {d.overtime > 0 ? (
                                <div className="flex flex-col h-full">
                                  <div className="bg-[#f59e0b] flex-1" style={{ flex: `0 0 ${(d.regular / d.hours) * 100}%` }} />
                                  <div className="bg-[#ef4444] flex-1" style={{ flex: `0 0 ${(d.overtime / d.hours) * 100}%` }} />
                                </div>
                              ) : (
                                <div
                                  className="h-full rounded-t-sm"
                                  style={{
                                    backgroundColor: d.status === 'APPROVED' ? '#1a1a1a'
                                      : d.status === 'SUBMITTED' ? '#6b7280'
                                      : '#d1d5cc',
                                  }}
                                />
                              )}
                            </div>
                          </div>
                          {/* Week label */}
                          <div className="text-[9px] text-[#8a8a85] font-medium text-center leading-tight">
                            {d.week ? `W${getWeekNumber(d.week)}` : '—'}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {/* Legend */}
                  <div className="flex items-center gap-4 mt-3 pt-3 border-t border-[#f0f0ec]">
                    <Legend color="#1a1a1a" label="Approved" />
                    <Legend color="#6b7280" label="Submitted" />
                    <Legend color="#f59e0b" label="Regular (OT week)" />
                    <Legend color="#ef4444" label="Overtime" />
                    <div className="flex items-center gap-1 ml-auto">
                      <div className="w-3 border-t border-dashed border-[#d1d5cc]" />
                      <span className="text-[9px] text-[#8a8a85]">40h expected</span>
                    </div>
                  </div>
                </div>
              </Section>
            )}

            {/* ── Section 4: Timesheet Summary ── */}
            <Section title="Timesheet Summary">
              <div className="grid grid-cols-4 gap-3">
                <StatCard label="Total Hours" value={`${tsSummary.total_hours || 0}h`} icon={<Clock size={14} />} color="#1a1a1a" />
                <StatCard label="Approved" value={tsSummary.approved || 0} icon={<CheckCircle size={14} />} color="#16a34a" />
                <StatCard label="Submitted" value={tsSummary.submitted || 0} icon={<FileText size={14} />} color="#f59e0b" />
                <StatCard label="Rejected" value={tsSummary.rejected || 0} icon={<AlertCircle size={14} />} color="#dc2626" />
              </div>
              {tsSummary.avg_hours > 0 && (
                <div className="mt-3 text-[11px] text-[#8a8a85]">
                  Average {tsSummary.avg_hours}h/week across {tsSummary.total_count} timesheet{tsSummary.total_count !== 1 ? 's' : ''}
                  {tsSummary.total_overtime > 0 && (
                    <span className="text-[#f59e0b] font-semibold"> · {tsSummary.total_overtime}h overtime total</span>
                  )}
                </div>
              )}
            </Section>

            {/* ── Section 5: Onboarding ── */}
            <Section title="Onboarding Progress">
              <div className="bg-white rounded-lg border border-[#eaeae6] p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-[12px] font-semibold text-[#1a1a1a]">
                    {ob.items_completed || 0} of {ob.items_total || 0} items completed
                  </div>
                  <span
                    className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase"
                    style={{
                      backgroundColor: ob.status === 'completed' ? '#dcfce7' : ob.status === 'in_progress' ? '#fef3c7' : '#f3f4f6',
                      color: ob.status === 'completed' ? '#166534' : ob.status === 'in_progress' ? '#92400e' : '#6b7280',
                    }}
                  >
                    {ob.status || 'not_started'}
                  </span>
                </div>
                {/* Progress bar */}
                <div className="w-full h-2 bg-[#e5e7eb] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${ob.completion_pct || 0}%`,
                      backgroundColor: ob.completion_pct === 100 ? '#16a34a' : '#f59e0b',
                    }}
                  />
                </div>
                <div className="text-right text-[11px] text-[#8a8a85] mt-1">{ob.completion_pct || 0}%</div>
              </div>
            </Section>

            {/* ── Section 6: Expenses & Issues ── */}
            <Section title="Expenses & Issues">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white rounded-lg border border-[#eaeae6] p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-7 h-7 rounded-md bg-[#f3f4f6] flex items-center justify-center">
                      <DollarSign size={14} className="text-[#6b7280]" />
                    </div>
                    <span className="text-[10px] uppercase tracking-wider text-[#8a8a85] font-semibold">Total Expenses</span>
                  </div>
                  <div className="text-[1.3rem] font-bold text-[#1a1a1a]">₹{(expenses.total || 0).toLocaleString()}</div>
                  <div className="text-[11px] text-[#8a8a85] mt-0.5">{(expenses.all || []).length} expense(s) logged</div>
                </div>
                <div className="bg-white rounded-lg border border-[#eaeae6] p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-7 h-7 rounded-md bg-[#f3f4f6] flex items-center justify-center">
                      <AlertCircle size={14} className={issues.open_count > 0 ? 'text-[#dc2626]' : 'text-[#6b7280]'} />
                    </div>
                    <span className="text-[10px] uppercase tracking-wider text-[#8a8a85] font-semibold">Issues</span>
                  </div>
                  <div className="text-[1.3rem] font-bold text-[#1a1a1a]">{issues.open_count || 0}</div>
                  <div className="text-[11px] text-[#8a8a85] mt-0.5">open issue(s)</div>
                </div>
              </div>
            </Section>

            {/* ── Section 7: Recent Activity Timeline ── */}
            {(notifs.length > 0 || (ts.all || []).length > 0) && (
              <Section title="Recent Activity">
                <div className="space-y-2">
                  {/* Timesheet activity */}
                  {(ts.all || []).slice(0, 5).map((t, i) => (
                    <div key={`ts-${i}`} className="flex items-start gap-3 p-3 bg-white rounded-lg border border-[#eaeae6]">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                        style={{ backgroundColor: tsColor(t.status).bg }}>
                        <Clock size={12} style={{ color: tsColor(t.status).text }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[12px] font-semibold text-[#1a1a1a]">
                          Timesheet {t.timesheet_number || t.id?.slice(0, 12)}
                        </div>
                        <div className="text-[11px] text-[#8a8a85]">
                          {t.period_label || t.week_start_date} · {t.total_hours || 0}h
                        </div>
                      </div>
                      <span
                        className="px-2 py-0.5 rounded-full text-[10px] font-bold flex-shrink-0"
                        style={{ backgroundColor: tsColor(t.status).bg, color: tsColor(t.status).text }}
                      >
                        {t.status}
                      </span>
                    </div>
                  ))}
                  {/* Notification activity */}
                  {notifs.slice(0, 3).map((n, i) => (
                    <div key={`notif-${i}`} className="flex items-start gap-3 p-3 bg-white rounded-lg border border-[#eaeae6]">
                      <div className="w-7 h-7 rounded-full bg-[#dbeafe] flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Bell size={12} className="text-[#3b82f6]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[12px] font-semibold text-[#1a1a1a]">{n.title || 'Notification'}</div>
                        <div className="text-[11px] text-[#8a8a85] truncate">{n.message || ''}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            )}
          </div>
        )}
      </div>
    </>
  );
}

// ── Sub-components ──

function Section({ title, children }) {
  return (
    <div>
      <div className="text-[10px] font-bold tracking-[0.14em] uppercase text-[#8a8a85] mb-2.5">{title}</div>
      {children}
    </div>
  );
}

function InfoRow({ icon, label, value, mono }) {
  return (
    <div className="bg-white rounded-lg border border-[#eaeae6] p-3">
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-[#8a8a85]">{icon}</span>
        <span className="text-[10px] uppercase tracking-wider text-[#8a8a85] font-semibold">{label}</span>
      </div>
      <div className={`text-[12.5px] font-semibold text-[#1a1a1a] ${mono ? 'font-mono' : ''} truncate`} title={value}>
        {value}
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, color }) {
  return (
    <div className="bg-white rounded-lg border border-[#eaeae6] p-3 text-center">
      <div className="flex items-center justify-center mb-1.5">
        <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ backgroundColor: `${color}15` }}>
          <span style={{ color }}>{icon}</span>
        </div>
      </div>
      <div className="text-[1.1rem] font-bold text-[#1a1a1a]">{value}</div>
      <div className="text-[10px] text-[#8a8a85] uppercase tracking-wider font-semibold">{label}</div>
    </div>
  );
}

function Legend({ color, label }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: color }} />
      <span className="text-[9px] text-[#8a8a85]">{label}</span>
    </div>
  );
}

function Bell(props) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

function getWeekNumber(dateStr) {
  try {
    const d = new Date(dateStr);
    const start = new Date(d.getFullYear(), 0, 1);
    const diff = d - start;
    const oneWeek = 1000 * 60 * 60 * 24 * 7;
    return Math.ceil(diff / oneWeek);
  } catch {
    return '—';
  }
}
