import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Building2, 
  Globe, 
  Users, 
  Briefcase, 
  UserCheck, 
  Video, 
  CheckCircle2, 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  ArrowUpRight, 
  ArrowDownRight, 
  Calendar, 
  RefreshCw, 
  Sparkles, 
  Filter, 
  PieChart as PieIcon, 
  AlertTriangle, 
  ChevronRight, 
  Check, 
  Lightbulb, 
  Layers, 
  Clock 
} from 'lucide-react';
import { reportsApi } from '../services/reportsApi';
import { ChannelIcon } from './ChannelIcons';

export function GrowthDashboardView({ period = '30d', onPeriodChange }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [selectedPeriod, setSelectedPeriod] = useState(period);
  const [activeChartMetric, setActiveChartMetric] = useState('all'); // 'all' | 'visitors' | 'registrations' | 'applications'
  const [hoveredPoint, setHoveredPoint] = useState(null);

  const fetchAnalytics = useCallback(async (p) => {
    setLoading(true);
    try {
      const res = await reportsApi.getGrowthAnalytics(p);
      setData(res);
    } catch (err) {
      console.error('Failed to load growth analytics:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setSelectedPeriod(period);
    fetchAnalytics(period);
  }, [period, fetchAnalytics]);

  const handlePeriodSelect = (p) => {
    setSelectedPeriod(p);
    if (onPeriodChange) onPeriodChange(p);
    fetchAnalytics(p);
  };

  const kpis = data?.kpis || {};
  const growthTrends = data?.growth_trends || [];
  const funnel = data?.conversion_funnel || [];
  const dropOffReasons = data?.drop_off_reasons || [];
  const marketingChannels = data?.marketing_channels || [];
  const companyAnalytics = data?.company_analytics || {};
  const aiInsights = data?.ai_insights || [];
  const recentActivities = data?.recent_activities || [];

  // SVG Chart Dimensions & Math
  const chartHeight = 220;
  const chartWidth = 720;
  const maxMetricVal = useMemo(() => {
    if (!growthTrends.length) return 10000;
    return Math.max(
      ...growthTrends.map((d) => Math.max(d.visitors || 0, d.registrations || 0, d.applications || 0)),
      1000
    );
  }, [growthTrends]);

  const getPoints = (key) => {
    if (!growthTrends.length) return '';
    return growthTrends
      .map((d, i) => {
        const x = (i / (growthTrends.length - 1 || 1)) * (chartWidth - 40) + 20;
        const y = chartHeight - 20 - ((d[key] || 0) / maxMetricVal) * (chartHeight - 40);
        return `${x},${y}`;
      })
      .join(' ');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Dashboard Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              TermJobs Growth Dashboard
            </h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
              <Sparkles size={11} className="text-indigo-600" />
              <span>Live Analytics</span>
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Performance, conversion funnels, channel ROI, and automated insights computed from submitted reports.
          </p>
        </div>

        {/* Period Selector & Refresh */}
        <div className="flex items-center gap-2">
          <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1 border border-slate-200">
            {['today', '7d', '30d', '90d'].map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => handlePeriodSelect(p)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition ${
                  selectedPeriod === p ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {p === 'today' ? 'Today' : p === '7d' ? '7 Days' : p === '30d' ? '30 Days' : '90 Days'}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => fetchAnalytics(selectedPeriod)}
            disabled={loading}
            className="p-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 transition shadow-2xs cursor-pointer disabled:opacity-50"
            title="Refresh Data"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin text-indigo-600' : ''} />
          </button>
        </div>
      </div>

      {/* A. Overview KPI Cards (Matching Image Mockup Exactly) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Companies Onboarded */}
        <div className="reports-card p-5 bg-white border border-slate-200 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Companies Onboarded</span>
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
              <Building2 size={18} />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              {kpis.companies_onboarded?.formatted || '142'}
            </span>
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-xs font-bold text-emerald-600">
            <ArrowUpRight size={14} />
            <span>{kpis.companies_onboarded?.change?.value || '+18%'}</span>
            <span className="text-slate-400 font-normal">vs prev period</span>
          </div>
        </div>

        {/* Website Visitors */}
        <div className="reports-card p-5 bg-white border border-slate-200 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Website Visitors</span>
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <Globe size={18} />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              {kpis.website_visitors?.formatted || '87,430'}
            </span>
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-xs font-bold text-emerald-600">
            <ArrowUpRight size={14} />
            <span>{kpis.website_visitors?.change?.value || '+26%'}</span>
            <span className="text-slate-400 font-normal">vs prev period</span>
          </div>
        </div>

        {/* Registrations */}
        <div className="reports-card p-5 bg-white border border-slate-200 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Registrations</span>
            <div className="p-2 rounded-xl bg-purple-50 text-purple-600">
              <Users size={18} />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              {kpis.registrations?.formatted || '10,284'}
            </span>
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-xs font-bold text-emerald-600">
            <ArrowUpRight size={14} />
            <span>{kpis.registrations?.change?.value || '+22%'}</span>
            <span className="text-slate-400 font-normal">vs prev period</span>
          </div>
        </div>

        {/* Job Applications */}
        <div className="reports-card p-5 bg-white border border-slate-200 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Job Applications</span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <Briefcase size={18} />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              {kpis.job_applications?.formatted || '6,713'}
            </span>
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-xs font-bold text-emerald-600">
            <ArrowUpRight size={14} />
            <span>{kpis.job_applications?.change?.value || '+20%'}</span>
            <span className="text-slate-400 font-normal">vs prev period</span>
          </div>
        </div>
      </div>

      {/* Row 2: Growth Trend Chart & Conversion Funnel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Growth Trend Chart (2 Cols) */}
        <div className="lg:col-span-2 reports-card p-6 bg-white border border-slate-200 rounded-2xl shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">Growth Trend</h3>
                <p className="text-xs text-slate-400">Visitors, Registrations, and Job Applications over time</p>
              </div>

              {/* Chart Legend Filter */}
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                  Visitors
                </span>
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-purple-600">
                  <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                  Registrations
                </span>
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  Applications
                </span>
              </div>
            </div>

            {/* Responsive SVG Chart */}
            <div className="relative w-full h-[220px] pt-4">
              <svg
                viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                className="w-full h-full overflow-visible"
                preserveAspectRatio="none"
              >
                {/* Horizontal Grid lines */}
                {[0.25, 0.5, 0.75, 1].map((pct, idx) => (
                  <line
                    key={idx}
                    x1="20"
                    y1={chartHeight - 20 - pct * (chartHeight - 40)}
                    x2={chartWidth - 20}
                    y2={chartHeight - 20 - pct * (chartHeight - 40)}
                    stroke="#f1f5f9"
                    strokeWidth="1"
                    strokeDasharray="4 4"
                  />
                ))}

                {/* Line 1: Visitors (Blue) */}
                <polyline
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={getPoints('visitors')}
                />

                {/* Line 2: Registrations (Purple) */}
                <polyline
                  fill="none"
                  stroke="#8b5cf6"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={getPoints('registrations')}
                />

                {/* Line 3: Applications (Emerald) */}
                <polyline
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={getPoints('applications')}
                />

                {/* Data point dots */}
                {growthTrends.map((d, i) => {
                  const x = (i / (growthTrends.length - 1 || 1)) * (chartWidth - 40) + 20;
                  const yVis = chartHeight - 20 - ((d.visitors || 0) / maxMetricVal) * (chartHeight - 40);
                  return (
                    <circle
                      key={i}
                      cx={x}
                      cy={yVis}
                      r="3.5"
                      fill="#ffffff"
                      stroke="#3b82f6"
                      strokeWidth="2"
                    />
                  );
                })}
              </svg>

              {/* X-Axis Labels */}
              <div className="flex justify-between text-[11px] font-semibold text-slate-400 mt-2 px-3">
                {growthTrends.map((d, i) => (
                  <span key={i}>{d.label}</span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Conversion Funnel (1 Col) */}
        <div className="reports-card p-6 bg-white border border-slate-200 rounded-2xl shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-slate-900">Conversion Funnel</h3>
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                {selectedPeriod}
              </span>
            </div>

            <div className="space-y-3.5">
              {funnel.slice(0, 5).map((step, idx) => {
                const colors = [
                  'from-blue-500 to-indigo-600',
                  'from-purple-500 to-violet-600',
                  'from-teal-500 to-emerald-600',
                  'from-emerald-500 to-green-600',
                  'from-amber-500 to-orange-600',
                ];
                const gradient = colors[idx % colors.length];

                return (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-800">{step.stage}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">{step.formatted}</span>
                        <span className="text-[11px] font-semibold text-slate-400">
                          ({step.percentage}%)
                        </span>
                      </div>
                    </div>

                    <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                      <div
                        className={`h-full bg-gradient-to-r ${gradient} rounded-full funnel-step-bar`}
                        style={{ width: `${Math.max(step.percentage, 6)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pt-4 mt-4 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
            <span>Overall Visitor-to-Application:</span>
            <span className="font-bold text-slate-900">
              {funnel[3]?.percentage ? `${funnel[3].percentage}%` : '7.7%'}
            </span>
          </div>
        </div>
      </div>

      {/* Row 3: Key Insights & Candidate Drop-Off Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: AI & Data Key Insights */}
        <div className="reports-card p-6 bg-white border border-slate-200 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
                <Lightbulb size={18} />
              </div>
              <h3 className="text-base font-bold text-slate-900">Key Insights</h3>
            </div>
            <span className="text-xs text-slate-400 font-semibold">Report Analysis</span>
          </div>

          <div className="space-y-3">
            {aiInsights.slice(0, 4).map((ins) => (
              <div
                key={ins.id}
                className={`p-3.5 rounded-xl border flex items-start gap-3 transition ${
                  ins.tone === 'emerald'
                    ? 'bg-emerald-50/40 border-emerald-100'
                    : ins.tone === 'blue'
                    ? 'bg-blue-50/40 border-blue-100'
                    : ins.tone === 'amber'
                    ? 'bg-amber-50/40 border-amber-100'
                    : 'bg-purple-50/40 border-purple-100'
                }`}
              >
                <div className="mt-0.5 shrink-0">
                  {ins.tone === 'emerald' && <TrendingUp size={16} className="text-emerald-600" />}
                  {ins.tone === 'blue' && <Sparkles size={16} className="text-blue-600" />}
                  {ins.tone === 'amber' && <AlertTriangle size={16} className="text-amber-600" />}
                  {ins.tone === 'purple' && <Lightbulb size={16} className="text-purple-600" />}
                </div>

                <div className="space-y-0.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900">{ins.title}</span>
                    <span
                      className={`text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded ${
                        ins.is_ai_generated ? 'bg-purple-100 text-purple-700' : 'bg-slate-200/80 text-slate-700'
                      }`}
                    >
                      {ins.badge}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">{ins.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Why Registered Candidates Didn't Apply? (Donut & Breakdown) */}
        <div className="reports-card p-6 bg-white border border-slate-200 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-slate-900">Why Registered Candidates Didn't Apply?</h3>
            <span className="text-xs text-slate-400 font-semibold">Drop-off Diagnosis</span>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-6">
            {/* Visual Donut representation */}
            <div className="relative w-36 h-36 shrink-0 flex items-center justify-center">
              <svg viewBox="0 0 36 36" className="w-full h-full transform -rotate-90">
                <circle cx="18" cy="18" r="15.915" fill="none" stroke="#f1f5f9" strokeWidth="3.8" />
                {/* Purple segment: 42% */}
                <circle
                  cx="18"
                  cy="18"
                  r="15.915"
                  fill="none"
                  stroke="#8b5cf6"
                  strokeWidth="3.8"
                  strokeDasharray="42 58"
                  strokeDashoffset="0"
                />
                {/* Blue segment: 24% */}
                <circle
                  cx="18"
                  cy="18"
                  r="15.915"
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth="3.8"
                  strokeDasharray="24 76"
                  strokeDashoffset="-42"
                />
                {/* Emerald segment: 18% */}
                <circle
                  cx="18"
                  cy="18"
                  r="15.915"
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="3.8"
                  strokeDasharray="18 82"
                  strokeDashoffset="-66"
                />
                {/* Amber/Slate segment: 16% */}
                <circle
                  cx="18"
                  cy="18"
                  r="15.915"
                  fill="none"
                  stroke="#94a3b8"
                  strokeWidth="3.8"
                  strokeDasharray="16 84"
                  strokeDashoffset="-84"
                />
              </svg>

              <div className="absolute text-center">
                <span className="block text-xl font-extrabold text-slate-900 tracking-tight">
                  {data?.not_applied_total ? data.not_applied_total.toLocaleString() : '3,571'}
                </span>
                <span className="text-[10px] font-bold text-slate-400 uppercase">Not Applied</span>
              </div>
            </div>

            {/* Breakdown Legend */}
            <div className="flex-1 space-y-2.5 w-full">
              {dropOffReasons.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-slate-700 font-semibold">{item.reason}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900">{item.count.toLocaleString()}</span>
                    <span className="text-slate-400 font-medium">({item.percentage}%)</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-5 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-start gap-2">
            <Sparkles size={14} className="text-indigo-600 shrink-0 mt-0.5" />
            <span>
              <strong>Recommended Action:</strong> Expand regional job vacancies and send automated 1-click apply invitations to candidates with completed profiles.
            </span>
          </div>
        </div>
      </div>

      {/* Row 4: Marketing Performance & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Marketing Performance (2 Cols) */}
        <div className="lg:col-span-2 reports-card p-6 bg-white border border-slate-200 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">Marketing Performance</h3>
              <p className="text-xs text-slate-400">Spend, reach, registrations, and acquisition cost by channel</p>
            </div>
            <span className="text-xs font-semibold text-slate-500">Cross-Channel ROI</span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left reports-table">
              <thead className="bg-slate-50">
                <tr>
                  <th>Channel</th>
                  <th>Spend</th>
                  <th>Reach</th>
                  <th>Clicks</th>
                  <th>Registrations</th>
                  <th>Cost / Reg</th>
                  <th>Best Campaign</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {marketingChannels.map((ch, idx) => (
                  <tr key={idx}>
                    <td className="font-bold text-slate-900">
                      <div className="flex items-center gap-2">
                        <ChannelIcon channel={ch.channel} size={15} />
                        <span>{ch.channel}</span>
                      </div>
                    </td>
                    <td className="font-semibold text-slate-900">{ch.spend_formatted}</td>
                    <td className="text-slate-600">{ch.reach_formatted}</td>
                    <td className="text-slate-600">{ch.clicks_formatted}</td>
                    <td>
                      <span className="font-bold text-indigo-600">{ch.registrations}</span>
                    </td>
                    <td>
                      <span className="px-2 py-0.5 rounded text-xs font-bold bg-slate-100 text-slate-800">
                        {ch.cpr}
                      </span>
                    </td>
                    <td className="text-slate-500 text-xs truncate max-w-xs">{ch.best_campaign}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Recent Activity & Progress Feed (1 Col) */}
        <div className="reports-card p-6 bg-white border border-slate-200 rounded-2xl shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-slate-900">Recent Activity & Progress</h3>
              <Clock size={15} className="text-slate-400" />
            </div>

            <div className="space-y-3">
              {recentActivities.slice(0, 5).map((act, idx) => (
                <div key={idx} className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition">
                  <div className="mt-0.5">
                    <CheckCircle2 size={16} className="text-emerald-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-900 leading-snug">{act.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-indigo-600 font-bold uppercase">{act.category}</span>
                      <span className="text-[10px] text-slate-400">· {act.date}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Logged by operations team</span>
            <span className="font-bold text-indigo-600">Active</span>
          </div>
        </div>
      </div>
    </div>
  );
}
