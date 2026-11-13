import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Building2, 
  Globe, 
  Users, 
  Briefcase, 
  UserCheck, 
  Video, 
  CheckCircle2, 
  TrendingUp, 
  TrendingDown, 
  Calendar, 
  RefreshCw, 
  Sparkles, 
  Filter, 
  AlertTriangle, 
  ChevronRight, 
  Check, 
  Lightbulb, 
  Layers, 
  Clock,
  Download,
  Printer,
  Zap,
  Target,
  Activity,
  Info,
  ExternalLink
} from 'lucide-react';
import { reportsApi } from '../services/reportsApi';
import { ChannelIcon } from './ChannelIcons';
import { ExportDateRangeModal } from './ExportDateRangeModal';

export function GrowthDashboardView({ period = '30d', onPeriodChange }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [selectedPeriod, setSelectedPeriod] = useState(period);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState('excel');
  const [toastMsg, setToastMsg] = useState('');

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

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 4000);
  };

  const handleOpenExport = (format) => {
    setExportFormat(format);
    setExportModalOpen(true);
  };

  const kpis = data?.kpis || {};
  const growthTrends = data?.growth_trends || [];
  const funnel = data?.conversion_funnel || [];
  const dropOffReasons = data?.drop_off_reasons || [];
  const marketingChannels = data?.marketing_channels || [];
  const companyAnalytics = data?.company_analytics || {};
  const aiInsights = data?.ai_insights || [];
  const recentActivities = data?.recent_activities || [];

  // SVG Chart Dimensions & Dynamic Scaling
  const chartHeight = 220;
  const chartWidth = 720;
  const maxMetricVal = useMemo(() => {
    if (!growthTrends.length) return 180;
    const maxVal = Math.max(
      ...growthTrends.map((d) => Math.max(d.visitors || 0, d.registrations || 0, d.applications || 0)),
      30
    );
    // Round up to nice upper boundary (e.g. 180)
    return Math.ceil(maxVal / 30) * 30 || 180;
  }, [growthTrends]);

  const getPoints = (key) => {
    if (!growthTrends.length) return '';
    return growthTrends
      .map((d, i) => {
        const x = (i / (growthTrends.length - 1 || 1)) * (chartWidth - 50) + 40;
        const y = chartHeight - 30 - ((d[key] || 0) / maxMetricVal) * (chartHeight - 50);
        return `${x},${y}`;
      })
      .join(' ');
  };

  const getAreaPath = (key) => {
    if (!growthTrends.length) return '';
    const points = growthTrends.map((d, i) => {
      const x = (i / (growthTrends.length - 1 || 1)) * (chartWidth - 50) + 40;
      const y = chartHeight - 30 - ((d[key] || 0) / maxMetricVal) * (chartHeight - 50);
      return { x, y };
    });
    const firstX = points[0].x;
    const lastX = points[points.length - 1].x;
    const baseY = chartHeight - 30;

    let path = `M${firstX},${baseY} L${points[0].x},${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      path += ` L${points[i].x},${points[i].y}`;
    }
    path += ` L${lastX},${baseY} Z`;
    return path;
  };

  const yTicks = [180, 150, 120, 90, 60, 30, 0];

  return (
    <div id="growth-print-container" className="w-full flex flex-col flex-1 divide-y divide-slate-100/90 text-left">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-xl border border-slate-700 text-xs font-semibold animate-fade-in">
          <CheckCircle2 size={16} className="text-emerald-400" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Dashboard Top Header inside Big Container */}
      <div className="reports-workspace-header flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              TermJobs Growth Dashboard
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>Live Analytics</span>
            </span>
          </div>
          <p className="text-xs sm:text-[13px] text-slate-500 mt-1">
            Performance, conversion funnels, channel ROI, and automated insights computed from submitted reports.
          </p>
        </div>

        {/* Period Selector & Action Toolbar */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-0.5 border border-slate-200/80">
            {['today', '7d', '30d', '90d'].map((p) => {
              const isActive = selectedPeriod === p;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => handlePeriodSelect(p)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition cursor-pointer ${
                    isActive
                      ? 'bg-[#103e2c] text-white shadow-2xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {p === 'today' ? 'Today' : p === '7d' ? '7 Days' : p === '30d' ? '30 Days' : '90 Days'}
                </button>
              );
            })}
          </div>

          {/* Export Excel Button with Date Coverage Dialog */}
          <button
            type="button"
            onClick={() => handleOpenExport('excel')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200/90 text-xs font-semibold shadow-2xs transition cursor-pointer"
            title="Download Reports & Analytics as Excel CSV with Date Range"
          >
            <Download size={13.5} className="text-emerald-600" />
            <span>Excel</span>
          </button>

          {/* Export PDF Button with Date Coverage Dialog */}
          <button
            type="button"
            onClick={() => handleOpenExport('pdf')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200/90 text-xs font-semibold shadow-2xs transition cursor-pointer"
            title="Print or Save as PDF with Date Range"
          >
            <Printer size={13.5} className="text-slate-600" />
            <span>PDF</span>
          </button>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={() => fetchAnalytics(selectedPeriod)}
            disabled={loading}
            className="p-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 transition shadow-2xs cursor-pointer disabled:opacity-50"
            title="Refresh Live Data"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin text-emerald-600' : 'text-slate-600'} />
          </button>
        </div>
      </div>

      {/* Row 1: 4 KPI Hero Cards with Wave Sparklines (Option D) */}
      <section className="reports-section-block">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* 1. Companies Onboarded */}
          <div className="p-4 sm:p-5 bg-white border border-slate-200/80 hover:border-emerald-300 rounded-2xl shadow-2xs transition relative overflow-hidden flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
                  <Building2 size={16} />
                </div>
                <span className="text-xs font-semibold text-slate-600">Companies Onboarded</span>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                  {kpis.companies_onboarded?.formatted ?? '2'}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-[11px] font-bold text-emerald-600">
                <span>↑ {kpis.companies_onboarded?.change?.value || '+100%'}</span>
                <span className="text-slate-400 font-normal">vs prev period</span>
              </div>
            </div>

            {/* Bottom-right decorative emerald sparkline wave */}
            <div className="absolute right-0 bottom-0 w-32 h-14 pointer-events-none opacity-80">
              <svg viewBox="0 0 100 40" className="w-full h-full" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="waveKpi1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d="M0,35 Q25,10 50,25 T100,5 L100,40 L0,40 Z" fill="url(#waveKpi1)" />
                <path d="M0,35 Q25,10 50,25 T100,5" fill="none" stroke="#10b981" strokeWidth="2" />
              </svg>
            </div>
          </div>

          {/* 2. Website Visitors */}
          <div className="p-4 sm:p-5 bg-white border border-slate-200/80 hover:border-emerald-300 rounded-2xl shadow-2xs transition relative overflow-hidden flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
                  <Globe size={16} />
                </div>
                <span className="text-xs font-semibold text-slate-600">Website Visitors</span>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                  {kpis.website_visitors?.formatted ?? '152'}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-[11px] font-bold text-emerald-600">
                <span>↑ {kpis.website_visitors?.change?.value || '+100%'}</span>
                <span className="text-slate-400 font-normal">vs prev period</span>
              </div>
            </div>

            <div className="absolute right-0 bottom-0 w-32 h-14 pointer-events-none opacity-80">
              <svg viewBox="0 0 100 40" className="w-full h-full" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="waveKpi2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d="M0,32 Q30,5 60,20 T100,8 L100,40 L0,40 Z" fill="url(#waveKpi2)" />
                <path d="M0,32 Q30,5 60,20 T100,8" fill="none" stroke="#10b981" strokeWidth="2" />
              </svg>
            </div>
          </div>

          {/* 3. Registrations */}
          <div className="p-4 sm:p-5 bg-white border border-slate-200/80 hover:border-emerald-300 rounded-2xl shadow-2xs transition relative overflow-hidden flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
                  <Users size={16} />
                </div>
                <span className="text-xs font-semibold text-slate-600">Registrations</span>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                  {kpis.registrations?.formatted ?? '17'}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-[11px] font-bold text-emerald-600">
                <span>↑ {kpis.registrations?.change?.value || '+100%'}</span>
                <span className="text-slate-400 font-normal">vs prev period</span>
              </div>
            </div>

            <div className="absolute right-0 bottom-0 w-32 h-14 pointer-events-none opacity-80">
              <svg viewBox="0 0 100 40" className="w-full h-full" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="waveKpi3" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d="M0,30 Q35,8 70,22 T100,10 L100,40 L0,40 Z" fill="url(#waveKpi3)" />
                <path d="M0,30 Q35,8 70,22 T100,10" fill="none" stroke="#10b981" strokeWidth="2" />
              </svg>
            </div>
          </div>

          {/* 4. Job Applications */}
          <div className="p-4 sm:p-5 bg-white border border-slate-200/80 hover:border-emerald-300 rounded-2xl shadow-2xs transition relative overflow-hidden flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
                  <Briefcase size={16} />
                </div>
                <span className="text-xs font-semibold text-slate-600">Job Applications</span>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                  {kpis.job_applications?.formatted ?? '33'}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-[11px] font-bold text-emerald-600">
                <span>↑ {kpis.job_applications?.change?.value || '+100%'}</span>
                <span className="text-slate-400 font-normal">vs prev period</span>
              </div>
            </div>

            <div className="absolute right-0 bottom-0 w-32 h-14 pointer-events-none opacity-80">
              <svg viewBox="0 0 100 40" className="w-full h-full" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="waveKpi4" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d="M0,34 Q30,12 60,26 T100,6 L100,40 L0,40 Z" fill="url(#waveKpi4)" />
                <path d="M0,34 Q30,12 60,26 T100,6" fill="none" stroke="#10b981" strokeWidth="2" />
              </svg>
            </div>
          </div>
        </div>
      </section>

      {/* Row 2: Growth Trend Chart & Conversion Funnel */}
      <section className="reports-section-block">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Growth Trend Chart (8 Cols) */}
          <div className="lg:col-span-8 p-5 bg-white rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col justify-between">
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <TrendingUp size={14} />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">Growth Trend</h3>
                    <p className="text-xs text-slate-400">Visitors, Registrations, and Job Applications over time</p>
                  </div>
                </div>

                {/* Chart Legend Filter */}
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    Visitors
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-purple-600">
                    <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                    Registrations
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-600">
                    <span className="w-2.5 h-2.5 rounded-full bg-teal-500" />
                    Applications
                  </span>
                </div>
              </div>

              {/* Area SVG Chart Matching Image */}
              <div className="relative w-full h-[220px] pt-2">
                <svg
                  viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                  className="w-full h-full overflow-visible"
                  preserveAspectRatio="none"
                >
                  <defs>
                    <linearGradient id="trendEmeraldArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity="0.22" />
                      <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  {/* Horizontal Grid lines with Y-Axis Markers */}
                  {yTicks.map((val, idx) => {
                    const yPos = chartHeight - 30 - (val / 180) * (chartHeight - 50);
                    return (
                      <g key={idx}>
                        <text
                          x="10"
                          y={yPos + 4}
                          fill="#94a3b8"
                          fontSize="10"
                          fontWeight="600"
                          textAnchor="start"
                        >
                          {val}
                        </text>
                        <line
                          x1="35"
                          y1={yPos}
                          x2={chartWidth - 10}
                          y2={yPos}
                          stroke="#f1f5f9"
                          strokeWidth="1"
                        />
                      </g>
                    );
                  })}

                  {/* Area fill for Visitors */}
                  {growthTrends.length > 0 && (
                    <path
                      d={getAreaPath('visitors')}
                      fill="url(#trendEmeraldArea)"
                    />
                  )}

                  {/* Line 1: Visitors (Green) */}
                  {growthTrends.length > 0 && (
                    <polyline
                      fill="none"
                      stroke="#10b981"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      points={getPoints('visitors')}
                    />
                  )}

                  {/* Line 2: Registrations (Purple) */}
                  {growthTrends.length > 0 && (
                    <polyline
                      fill="none"
                      stroke="#8b5cf6"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      points={getPoints('registrations')}
                    />
                  )}

                  {/* Line 3: Applications (Teal) */}
                  {growthTrends.length > 0 && (
                    <polyline
                      fill="none"
                      stroke="#14b8a6"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      points={getPoints('applications')}
                    />
                  )}

                  {/* Node circles for Visitors */}
                  {growthTrends.map((d, i) => {
                    const x = (i / (growthTrends.length - 1 || 1)) * (chartWidth - 50) + 40;
                    const y = chartHeight - 30 - ((d.visitors || 0) / maxMetricVal) * (chartHeight - 50);
                    return (
                      <circle
                        key={i}
                        cx={x}
                        cy={y}
                        r="3.5"
                        fill="#ffffff"
                        stroke="#10b981"
                        strokeWidth="2"
                      />
                    );
                  })}
                </svg>

                {/* X-axis date labels */}
                <div className="flex justify-between px-7 pt-2 text-[10px] text-slate-400 font-semibold">
                  {growthTrends.map((d, i) => (
                    <span key={i} className="truncate">
                      {d.label}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Right: Conversion Funnel (4 Cols) */}
          <div className="lg:col-span-4 p-5 bg-white rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <Filter size={14} />
                  </div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">Conversion Funnel</h3>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 uppercase tracking-wider">
                  {selectedPeriod}
                </span>
              </div>

              <div className="space-y-3.5">
                {funnel.slice(0, 5).map((step, idx) => {
                  return (
                    <div key={idx} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-800">{step.stage}</span>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-slate-900">{step.formatted}</span>
                          <span className="text-[11px] font-semibold text-slate-400">
                            ({step.percentage}%)
                          </span>
                        </div>
                      </div>

                      <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                        <div
                          className="h-full bg-emerald-700 rounded-full transition-all duration-500"
                          style={{ width: `${Math.max(step.percentage, 8)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Overall Conversion Pill in Emerald Tint */}
            <div className="pt-4 mt-4 border-t border-slate-100">
              <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-100 flex items-center justify-between text-emerald-950 font-bold text-xs">
                <div className="flex items-center gap-2">
                  <Target size={15} className="text-emerald-700" />
                  <span>Overall Visitor-to-Application</span>
                </div>
                <span className="text-sm font-extrabold text-emerald-700">
                  {funnel[3]?.percentage !== undefined ? `${funnel[3].percentage}%` : '21.7%'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Row 3: Key Insights & Candidate Drop-Off Analysis */}
      <section className="reports-section-block">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: AI & Data Key Insights */}
          <div className="p-5 bg-white rounded-2xl border border-slate-200/90 shadow-2xs">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                  <Lightbulb size={14} />
                </div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">Key Insights</h3>
              </div>
              <span className="text-[11px] text-slate-400 font-semibold hover:text-slate-700 cursor-pointer flex items-center gap-0.5">
                Report Analysis <ChevronRight size={12} />
              </span>
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
                    {ins.tone === 'emerald' && <TrendingUp size={15} className="text-emerald-600" />}
                    {ins.tone === 'blue' && <Zap size={15} className="text-blue-600" />}
                    {ins.tone === 'amber' && <Layers size={15} className="text-amber-600" />}
                    {ins.tone === 'purple' && <Target size={15} className="text-purple-600" />}
                  </div>

                  <div className="space-y-0.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900">{ins.title}</span>
                      <span
                        className={`text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded ${
                          ins.tone === 'emerald'
                            ? 'bg-emerald-100 text-emerald-800'
                            : ins.tone === 'blue'
                            ? 'bg-blue-100 text-blue-800'
                            : ins.tone === 'amber'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-purple-100 text-purple-800'
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
          <div className="p-5 bg-white rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <Layers size={14} />
                  </div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">Why Registered Candidates Didn't Apply?</h3>
                </div>
                <span className="text-[11px] text-slate-400 font-semibold hover:text-slate-700 cursor-pointer flex items-center gap-0.5">
                  Drop-off Diagnosis <ChevronRight size={12} />
                </span>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-6">
                {/* Visual Donut representation with neon green/purple gradient stroke */}
                <div className="relative w-36 h-36 shrink-0 flex items-center justify-center">
                  <svg viewBox="0 0 36 36" className="w-full h-full transform -rotate-90">
                    <circle cx="18" cy="18" r="15.915" fill="none" stroke="#f1f5f9" strokeWidth="3.8" />
                    <circle
                      cx="18"
                      cy="18"
                      r="15.915"
                      fill="none"
                      stroke="#10b981"
                      strokeWidth="3.8"
                      strokeDasharray="75 25"
                      strokeDashoffset="0"
                    />
                    <circle
                      cx="18"
                      cy="18"
                      r="15.915"
                      fill="none"
                      stroke="#8b5cf6"
                      strokeWidth="3.8"
                      strokeDasharray="25 75"
                      strokeDashoffset="-75"
                    />
                  </svg>

                  <div className="absolute text-center">
                    <span className="block text-2xl font-extrabold text-slate-900 tracking-tight">
                      {data?.not_applied_total != null ? data.not_applied_total.toLocaleString() : '0'}
                    </span>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Not Applied</span>
                  </div>
                </div>

                {/* Breakdown Legend */}
                <div className="flex-1 space-y-2.5 w-full">
                  {dropOffReasons.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color || '#10b981' }} />
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
            </div>

            <div className="mt-5 p-3 rounded-xl bg-emerald-50/50 border border-emerald-100/80 text-xs text-slate-700 flex items-start gap-2 shadow-2xs">
              <Sparkles size={14} className="text-emerald-700 shrink-0 mt-0.5" />
              <span>
                <strong>Recommended Action:</strong> Expand regional job vacancies and send automated 1-click apply invitations to candidates with completed profiles.
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Row 4: Marketing Performance & Recent Activity */}
      <section className="reports-section-block">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Marketing Performance (7 Cols) */}
          <div className="lg:col-span-7 p-5 bg-white rounded-2xl border border-slate-200/90 shadow-2xs">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <Layers size={14} />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">Marketing Performance</h3>
                  <p className="text-xs text-slate-400">Spend, reach, registrations, and acquisition cost by channel</p>
                </div>
              </div>
              <span className="text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer flex items-center gap-1">
                Cross-Channel ROI <ExternalLink size={12} />
              </span>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200/90 shadow-2xs">
              <table className="w-full text-left reports-table">
                <thead className="bg-emerald-50/50">
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
                    <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
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
                        <span className={`font-bold ${ch.registrations > 0 ? 'text-emerald-700' : 'text-slate-600'}`}>
                          {ch.registrations}
                        </span>
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

          {/* Right: Recent Activity & Progress Feed (5 Cols) */}
          <div className="lg:col-span-5 p-5 bg-white rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <Activity size={14} />
                  </div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">Recent Activity & Progress</h3>
                </div>
                <Info size={14} className="text-slate-400" />
              </div>

              <div className="space-y-2.5">
                {recentActivities.slice(0, 5).map((act, idx) => (
                  <div key={idx} className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-50/50 border border-slate-100 hover:border-slate-200 transition">
                    <div className="mt-0.5">
                      <CheckCircle2 size={15} className="text-emerald-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-900 leading-snug">{act.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-emerald-700 font-bold uppercase">{act.category}</span>
                        <span className="text-[10px] text-slate-400">· {act.date}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <div className="flex items-center gap-1.5">
                <Users size={13} className="text-slate-400" />
                <span>Logged by operations team</span>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                Active
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Date Range Export Modal */}
      <ExportDateRangeModal
        isOpen={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        exportFormat={exportFormat}
        analyticsData={data}
        onExportComplete={(msg) => showToast(msg)}
      />
    </div>
  );
}
