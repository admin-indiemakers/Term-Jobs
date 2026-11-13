import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Building2, 
  Users, 
  Briefcase, 
  UserCheck, 
  UserPlus,
  CheckSquare, 
  Calendar, 
  Plus, 
  Trash2, 
  Edit3, 
  Save, 
  Send, 
  Sparkles, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  ChevronDown, 
  ChevronRight,
  Check,
  History, 
  Search, 
  Globe, 
  Video, 
  BarChart2, 
  FileText,
  HelpCircle,
  X,
  Download,
  Printer,
  RefreshCw,
  TrendingUp,
  Lightbulb,
  Layers
} from 'lucide-react';
import { ChannelIcon } from './ChannelIcons';
import { reportsApi } from '../services/reportsApi';
import { exportToExcel, exportToPdf } from '../services/exportReports';

const DEFAULT_METRICS = {
  companies_onboarded: '',
  website_visitors: '',
  new_registrations: '',
  profile_completions: '',
  job_applications: '',
  candidates_shortlisted: '',
  interviews_conducted: '',
  candidates_hired: '',
  new_vacancies_posted: '',
};

const DEFAULT_WORK_CHECKLIST = [
  { id: 'company_onboarding', label: 'Company onboarding & follow-up', checked: false, note: '' },
  { id: 'job_vacancies', label: 'Job vacancies published', checked: false, note: '' },
  { id: 'candidate_registrations', label: 'Candidate registrations & profiles', checked: false, note: '' },
  { id: 'applications_shortlisting', label: 'Applications & Shortlisting', checked: false, note: '' },
  { id: 'ai_interview_screening', label: 'AI Interview Screening', checked: false, note: '' },
  { id: 'candidate_support', label: 'Candidate support & queries', checked: false, note: '' },
];

const DEFAULT_OBSERVATIONS = {
  what_went_well: '',
  issues_faced: '',
  why_candidates_not_applying: '',
  why_visitors_leaving: '',
  company_feedback: '',
  improvements_needed: '',
};

export function ReportsProgressView({ user, onReportSaved }) {
  const [reportType, setReportType] = useState('daily'); // 'daily' | 'weekly' | 'monthly'
  const [reportDate, setReportDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [syncingDb, setSyncingDb] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [reportStatus, setReportStatus] = useState('draft'); // 'draft' | 'submitted'
  const [currentReportId, setCurrentReportId] = useState(null);
  const [showObsTextareas, setShowObsTextareas] = useState(false);

  // Form State
  const [metrics, setMetrics] = useState(DEFAULT_METRICS);
  const [workProgress, setWorkProgress] = useState(DEFAULT_WORK_CHECKLIST);
  const [marketingActivities, setMarketingActivities] = useState([]);
  const [observations, setObservations] = useState(DEFAULT_OBSERVATIONS);
  const [actionItems, setActionItems] = useState([
    { id: 'task-1', task: 'Follow up with active candidate applications', assignee: 'Operations', priority: 'High', deadline: 'Tomorrow', completed: false },
    { id: 'task-2', task: 'Review AI interview evaluation scorecards', assignee: 'Hiring Team', priority: 'Medium', deadline: 'End of week', completed: false },
  ]);

  // Modals & Drawers
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [editingActivity, setEditingActivity] = useState(null);
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);
  const [pastReportsList, setPastReportsList] = useState([]);

  // Activity Modal Form State
  const [activityForm, setActivityForm] = useState({
    platform: 'Instagram',
    content_type: 'Post',
    title: '',
    description: '',
    spend: '',
    reach: '',
    impressions: '',
    clicks: '',
    engagement: '',
    leads: '',
    registrations: '',
    applications: '',
  });

  // Load report when date or reportType changes
  const loadReport = useCallback(async (dateVal, typeVal) => {
    setLoading(true);
    try {
      const res = await reportsApi.getReportByDate(dateVal, typeVal);
      if (res && res.report) {
        const rep = res.report;
        setCurrentReportId(rep.id);
        setReportStatus(rep.status || 'draft');
        setMetrics({
          companies_onboarded: rep.metrics?.companies_onboarded ?? '',
          website_visitors: rep.metrics?.website_visitors ?? '',
          new_registrations: rep.metrics?.new_registrations ?? '',
          profile_completions: rep.metrics?.profile_completions ?? '',
          job_applications: rep.metrics?.job_applications ?? '',
          candidates_shortlisted: rep.metrics?.candidates_shortlisted ?? '',
          interviews_conducted: rep.metrics?.interviews_conducted ?? '',
          candidates_hired: rep.metrics?.candidates_hired ?? '',
          new_vacancies_posted: rep.metrics?.new_vacancies_posted ?? '',
        });
        setWorkProgress(Array.isArray(rep.work_progress) && rep.work_progress.length > 0 ? rep.work_progress : DEFAULT_WORK_CHECKLIST);
        setMarketingActivities(Array.isArray(rep.marketing_activities) ? rep.marketing_activities : []);
        setObservations(rep.observations ? { ...DEFAULT_OBSERVATIONS, ...rep.observations } : DEFAULT_OBSERVATIONS);
        if (Array.isArray(rep.action_items) && rep.action_items.length > 0) {
          setActionItems(rep.action_items);
        }
      } else {
        // Reset to clean default values for new entry
        setCurrentReportId(null);
        setReportStatus('draft');
        setMetrics(DEFAULT_METRICS);
        setWorkProgress(DEFAULT_WORK_CHECKLIST);
        setMarketingActivities([]);
        setObservations(DEFAULT_OBSERVATIONS);
      }
    } catch (err) {
      console.warn('Failed to fetch existing report:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReport(reportDate, reportType);
  }, [reportDate, reportType, loadReport]);

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 4000);
  };

  const handleSyncDbMetrics = async () => {
    setSyncingDb(true);
    try {
      const res = await reportsApi.getDbMetrics(reportDate);
      if (res && res.metrics) {
        setMetrics({
          companies_onboarded: res.metrics.companies_onboarded ?? 0,
          website_visitors: res.metrics.website_visitors ?? 0,
          new_registrations: res.metrics.new_registrations ?? 0,
          profile_completions: res.metrics.profile_completions ?? 0,
          job_applications: res.metrics.job_applications ?? 0,
          candidates_shortlisted: res.metrics.candidates_shortlisted ?? 0,
          interviews_conducted: res.metrics.interviews_conducted ?? 0,
          candidates_hired: res.metrics.candidates_hired ?? 0,
          new_vacancies_posted: res.metrics.new_vacancies_posted ?? 0,
        });

        // Auto-check work progress items if activities detected in DB
        const hasVacancies = Number(res.metrics.new_vacancies_posted) > 0;
        const hasCandidates = Number(res.metrics.new_registrations) > 0;
        const hasApps = Number(res.metrics.job_applications) > 0;
        const hasInterviews = Number(res.metrics.interviews_conducted) > 0;
        const hasCompanies = Number(res.metrics.companies_onboarded) > 0;

        setWorkProgress((prev) =>
          prev.map((item) => {
            if (item.id === 'job_vacancies' && hasVacancies) {
              return { ...item, checked: true, note: `${res.metrics.new_vacancies_posted} new vacancy posted in DB` };
            }
            if (item.id === 'candidate_registrations' && hasCandidates) {
              return { ...item, checked: true, note: `${res.metrics.new_registrations} candidate registration(s) verified` };
            }
            if (item.id === 'applications_shortlisting' && hasApps) {
              return { ...item, checked: true, note: `${res.metrics.job_applications} application(s) received` };
            }
            if (item.id === 'ai_interview_screening' && hasInterviews) {
              return { ...item, checked: true, note: `${res.metrics.interviews_conducted} AI interview(s) conducted` };
            }
            if (item.id === 'company_onboarding' && hasCompanies) {
              return { ...item, checked: true, note: `${res.metrics.companies_onboarded} company onboarded` };
            }
            return item;
          })
        );

        showToast(`Synced real database metrics for ${reportDate}`);
      }
    } catch (err) {
      console.error('Failed to sync DB metrics:', err);
      showToast('Could not fetch metrics from database');
    } finally {
      setSyncingDb(false);
    }
  };

  const handleExportExcel = () => {
    const currentReport = {
      report_date: reportDate,
      report_type: reportType,
      status: reportStatus,
      author_name: user?.name || user?.full_name || 'Team Member',
      metrics,
      work_progress: workProgress,
      marketing_activities: marketingActivities,
      observations,
      action_items: actionItems,
    };
    exportToExcel([currentReport], null, `TermJobs_Report_${reportDate}.csv`);
    showToast('Downloaded Excel (.csv) report');
  };

  const handleExportPdf = () => {
    exportToPdf();
  };

  const handleSave = async (submitStatus = 'draft') => {
    setSaving(true);
    try {
      const payload = {
        report_type: reportType,
        report_date: reportDate,
        status: submitStatus,
        author_id: user?.id || user?._id || 'user_1',
        author_name: user?.name || user?.full_name || 'Team Member',
        author_email: user?.email || '',
        author_role: user?.role || 'Operator',
        metrics: {
          companies_onboarded: Number(metrics.companies_onboarded) || 0,
          website_visitors: Number(metrics.website_visitors) || 0,
          new_registrations: Number(metrics.new_registrations) || 0,
          profile_completions: Number(metrics.profile_completions) || 0,
          job_applications: Number(metrics.job_applications) || 0,
          candidates_shortlisted: Number(metrics.candidates_shortlisted) || 0,
          interviews_conducted: Number(metrics.interviews_conducted) || 0,
          candidates_hired: Number(metrics.candidates_hired) || 0,
          new_vacancies_posted: Number(metrics.new_vacancies_posted) || 0,
        },
        work_progress: workProgress,
        marketing_activities: marketingActivities,
        observations: observations,
        action_items: actionItems,
      };

      const res = await reportsApi.saveReport(payload);
      if (res && res.report) {
        setCurrentReportId(res.report.id);
        setReportStatus(res.report.status);
        showToast(
          submitStatus === 'submitted'
            ? 'Report submitted and locked for growth analytics!'
            : 'Draft saved successfully'
        );
        if (onReportSaved) onReportSaved(res.report);
      }
    } catch (err) {
      console.error('Save failed:', err);
      showToast('Error saving report. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleMetricChange = (field, val) => {
    setMetrics((prev) => ({ ...prev, [field]: val }));
  };

  const toggleWorkItem = (id) => {
    setWorkProgress((prev) =>
      prev.map((item) => (item.id === id ? { ...item, checked: !item.checked } : item))
    );
  };

  const updateWorkNote = (id, noteVal) => {
    setWorkProgress((prev) =>
      prev.map((item) => (item.id === id ? { ...item, note: noteVal } : item))
    );
  };

  const handleOpenAddActivity = () => {
    setEditingActivity(null);
    setActivityForm({
      platform: 'Instagram',
      content_type: 'Post',
      title: '',
      description: '',
      spend: '',
      reach: '',
      impressions: '',
      clicks: '',
      engagement: '',
      leads: '',
      registrations: '',
      applications: '',
    });
    setShowActivityModal(true);
  };

  const handleEditActivity = (act) => {
    setEditingActivity(act);
    setActivityForm({
      platform: act.platform || 'Instagram',
      content_type: act.content_type || 'Post',
      title: act.title || '',
      description: act.description || '',
      spend: act.spend ?? '',
      reach: act.reach ?? '',
      impressions: act.impressions ?? '',
      clicks: act.clicks ?? '',
      engagement: act.engagement ?? '',
      leads: act.leads ?? '',
      registrations: act.registrations ?? '',
      applications: act.applications ?? '',
    });
    setShowActivityModal(true);
  };

  const handleDeleteActivity = (actId) => {
    setMarketingActivities((prev) => prev.filter((a) => a.id !== actId));
  };

  const handleSaveActivityModal = (e) => {
    e.preventDefault();
    if (!activityForm.title.trim()) return;

    if (editingActivity) {
      setMarketingActivities((prev) =>
        prev.map((a) =>
          a.id === editingActivity.id
            ? {
                ...a,
                ...activityForm,
                spend: Number(activityForm.spend) || 0,
                reach: Number(activityForm.reach) || 0,
                impressions: Number(activityForm.impressions) || 0,
                clicks: Number(activityForm.clicks) || 0,
                engagement: Number(activityForm.engagement) || 0,
                leads: Number(activityForm.leads) || 0,
                registrations: Number(activityForm.registrations) || 0,
                applications: Number(activityForm.applications) || 0,
              }
            : a
        )
      );
    } else {
      const newAct = {
        id: `act_${Date.now()}`,
        ...activityForm,
        spend: Number(activityForm.spend) || 0,
        reach: Number(activityForm.reach) || 0,
        impressions: Number(activityForm.impressions) || 0,
        clicks: Number(activityForm.clicks) || 0,
        engagement: Number(activityForm.engagement) || 0,
        leads: Number(activityForm.leads) || 0,
        registrations: Number(activityForm.registrations) || 0,
        applications: Number(activityForm.applications) || 0,
      };
      setMarketingActivities((prev) => [newAct, ...prev]);
    }
    setShowActivityModal(false);
  };

  const toggleActionItem = (id) => {
    setActionItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, completed: !item.completed } : item))
    );
  };

  const addActionItem = () => {
    const newTask = {
      id: `task_${Date.now()}`,
      task: 'New strategic action item',
      assignee: 'Operations',
      priority: 'Medium',
      deadline: 'Upcoming',
      completed: false,
    };
    setActionItems((prev) => [...prev, newTask]);
  };

  const openHistoryDrawer = async () => {
    try {
      const res = await reportsApi.getReports({ limit: 30 });
      setPastReportsList(res?.reports || []);
    } catch (e) {
      console.warn('Error fetching past reports', e);
    }
    setShowHistoryDrawer(true);
  };

  // Work progress completion computation
  const completedWorkCount = useMemo(() => {
    return workProgress.filter((w) => Boolean(w.checked)).length;
  }, [workProgress]);

  const workProgressPct = useMemo(() => {
    if (!workProgress.length) return 0;
    return Math.round((completedWorkCount / workProgress.length) * 100);
  }, [completedWorkCount, workProgress.length]);

  // Dynamic Hero Overview Metric
  const heroData = useMemo(() => {
    const vac = Number(metrics.new_vacancies_posted) || 0;
    const apps = Number(metrics.job_applications) || 0;
    const vis = Number(metrics.website_visitors) || 0;
    const regs = Number(metrics.new_registrations) || 0;

    if (vac > 0) {
      return { val: vac, label: 'Vacancies Posted', trend: '+100%', subtitle: 'Key positions open in database' };
    }
    if (apps > 0) {
      return { val: apps, label: 'Job Applications', trend: '+20%', subtitle: 'Candidate submissions today' };
    }
    if (regs > 0) {
      return { val: regs, label: 'New Registrations', trend: '+15%', subtitle: 'New talent registered' };
    }
    if (vis > 0) {
      return { val: vis, label: 'Website Visitors', trend: '+25%', subtitle: 'Live platform visitors' };
    }
    return { val: 0, label: 'Vacancies Posted', trend: '+0%', subtitle: 'Key metrics at a glance' };
  }, [metrics]);

  // Observations bullet items
  const observationBullets = useMemo(() => {
    const list = [];
    if (observations.what_went_well?.trim()) {
      observations.what_went_well.split('\n').forEach((line) => {
        const cleaned = line.replace(/^[•\-\*]\s*/, '').trim();
        if (cleaned) list.push(cleaned);
      });
    }
    if (observations.issues_faced?.trim()) {
      observations.issues_faced.split('\n').forEach((line) => {
        const cleaned = line.replace(/^[•\-\*]\s*/, '').trim();
        if (cleaned) list.push(cleaned);
      });
    }
    if (list.length === 0) {
      const vac = Number(metrics.new_vacancies_posted) || 0;
      if (vac > 0) {
        list.push(`${vac} vacancies posted across tech and non-tech categories.`);
      } else {
        list.push('No observations logged yet. Click below to add operational notes.');
      }
    }
    return list;
  }, [observations, metrics.new_vacancies_posted]);

  return (
    <div id="reports-print-container" className="w-full flex flex-col flex-1 divide-y divide-slate-100/90 text-left">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-xl border border-slate-700 text-xs font-semibold animate-fade-in">
          <CheckCircle2 size={16} className="text-emerald-400" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Top Header matching Option D */}
      <div className="reports-workspace-header flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              Reports & Progress
            </h1>
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                reportStatus === 'submitted'
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/80'
                  : 'bg-amber-50 text-amber-700 border border-amber-200/80'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${reportStatus === 'submitted' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              {reportStatus === 'submitted' ? 'Submitted' : 'Draft'}
            </span>
          </div>
          <p className="text-xs sm:text-[13px] text-slate-500 mt-1">
            Log your daily work, business metrics, marketing results, and strategic observations.
          </p>
        </div>

        {/* Date Selector & Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          {/* Sub-tabs: Daily Report / Weekly Summary / Monthly Summary */}
          <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-0.5 border border-slate-200/80">
            <button
              type="button"
              onClick={() => setReportType('daily')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                reportType === 'daily' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Daily Report
            </button>
            <button
              type="button"
              onClick={() => setReportType('weekly')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                reportType === 'weekly' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Weekly Summary
            </button>
            <button
              type="button"
              onClick={() => setReportType('monthly')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                reportType === 'monthly' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Monthly Summary
            </button>
          </div>

          {/* Date Picker Input */}
          <div className="relative">
            <input
              type="date"
              value={reportDate}
              onChange={(e) => setReportDate(e.target.value)}
              className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 shadow-2xs focus:ring-2 focus:ring-slate-900 cursor-pointer"
            />
          </div>

          {/* History Button */}
          <button
            type="button"
            onClick={openHistoryDrawer}
            className="p-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 transition shadow-2xs cursor-pointer"
            title="View Past Reports"
          >
            <History size={15} />
          </button>

          {/* Export Excel Button */}
          <button
            type="button"
            onClick={handleExportExcel}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200/90 text-xs font-semibold shadow-2xs transition cursor-pointer"
            title="Download Report as Excel CSV"
          >
            <Download size={13.5} className="text-emerald-600" />
            <span>Excel</span>
          </button>

          {/* Export PDF Button */}
          <button
            type="button"
            onClick={handleExportPdf}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200/90 text-xs font-semibold shadow-2xs transition cursor-pointer"
            title="Print or Save as PDF"
          >
            <Printer size={13.5} className="text-slate-600" />
            <span>PDF</span>
          </button>

          {/* Save Draft Button */}
          <button
            type="button"
            disabled={saving}
            onClick={() => handleSave('draft')}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200/90 text-xs font-semibold shadow-2xs transition cursor-pointer disabled:opacity-50"
          >
            <Save size={13.5} />
            <span>Save Draft</span>
          </button>

          {/* Submit Button in Signature Emerald Green */}
          <button
            type="button"
            disabled={saving}
            onClick={() => handleSave('submitted')}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition cursor-pointer disabled:opacity-50"
          >
            <Send size={13.5} />
            <span>{saving ? 'Saving...' : 'Submit Report'}</span>
          </button>
        </div>
      </div>

      {/* 1. Today's Key Numbers + Hero Overview Card (Option D Layout) */}
      <section className="reports-section-block">
        <div className="reports-section-heading mb-3.5">
          <div className="flex items-center gap-2.5">
            <span className="reports-number-badge">1</span>
            <h2 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
              Today's Key Numbers
            </h2>
            <div className="group relative">
              <HelpCircle size={14} className="text-slate-400 hover:text-slate-600 cursor-pointer" />
              <div className="absolute left-0 bottom-full mb-1 hidden group-hover:block w-64 p-2 bg-slate-900 text-white text-[11px] rounded-lg shadow-lg z-20">
                Log today's platform operations numbers. The Growth Dashboard automatically aggregates these metrics over time.
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={syncingDb}
              onClick={handleSyncDbMetrics}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/80 text-[11px] font-bold shadow-2xs transition cursor-pointer disabled:opacity-50"
              title="Auto-fill numbers directly from verified database records"
            >
              <RefreshCw size={12} className={syncingDb ? 'animate-spin text-emerald-700' : 'text-emerald-700'} />
              <span>{syncingDb ? 'Syncing...' : 'Auto-Fill from Database'}</span>
            </button>
            <span className="hidden sm:inline text-[11px] text-slate-400 font-medium">· Verified main DB records</span>
          </div>
        </div>

        {/* Option D Split: Hero Card on Left + 8 Metric Cards on Right */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
          {/* Left: Signature Hero "Today's Overview" Sparkline Card */}
          <div className="lg:col-span-3 bg-gradient-to-br from-emerald-50/80 via-emerald-50/20 to-white border border-emerald-200/90 rounded-2xl p-4.5 flex flex-col justify-between shadow-2xs relative overflow-hidden">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <Sparkles size={13} />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-900">Today's Overview</h3>
                  <p className="text-[10px] text-slate-500">Key metrics at a glance</p>
                </div>
              </div>

              <div className="mt-4">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-slate-900 tracking-tight">
                    {heroData.val}
                  </span>
                  <span className="text-xs font-bold text-slate-700">{heroData.label}</span>
                </div>
                <div className="mt-1 flex items-center gap-1.5 text-[11px] font-bold text-emerald-700">
                  <TrendingUp size={12} />
                  <span>{heroData.trend} vs yesterday</span>
                </div>
              </div>
            </div>

            {/* Emerald SVG Decorative Wave Sparkline */}
            <div className="mt-3 -mx-4.5 -mb-4.5 pt-2">
              <svg viewBox="0 0 200 55" className="w-full h-12 overflow-visible" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="emeraldWaveGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity="0.28" />
                    <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                  </linearGradient>
                </defs>
                <path
                  d="M0,45 Q30,15 60,32 T120,20 T170,10 T200,18 L200,55 L0,55 Z"
                  fill="url(#emeraldWaveGrad)"
                />
                <path
                  d="M0,45 Q30,15 60,32 T120,20 T170,10 T200,18"
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                />
              </svg>
            </div>
          </div>

          {/* Right: 8 Compact Metric Cards in 4x2 Grid */}
          <div className="lg:col-span-9 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* 1. Companies Onboarded */}
            <div className="metric-input-card bg-white hover:border-emerald-300">
              <div className="flex items-center gap-2 text-slate-500">
                <div className="w-6 h-6 rounded-md bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                  <Building2 size={13} />
                </div>
                <span className="text-xs font-semibold truncate">Companies</span>
              </div>
              <input
                type="number"
                placeholder="0"
                value={metrics.companies_onboarded}
                onChange={(e) => handleMetricChange('companies_onboarded', e.target.value)}
                className="w-full text-xl sm:text-2xl font-extrabold text-slate-900 bg-transparent border-0 focus:outline-hidden p-0 tracking-tight"
              />
            </div>

            {/* 2. Website Visitors */}
            <div className="metric-input-card bg-white hover:border-emerald-300">
              <div className="flex items-center gap-2 text-slate-500">
                <div className="w-6 h-6 rounded-md bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                  <Globe size={13} />
                </div>
                <span className="text-xs font-semibold truncate">Website Visitors</span>
              </div>
              <input
                type="number"
                placeholder="0"
                value={metrics.website_visitors}
                onChange={(e) => handleMetricChange('website_visitors', e.target.value)}
                className="w-full text-xl sm:text-2xl font-extrabold text-slate-900 bg-transparent border-0 focus:outline-hidden p-0 tracking-tight"
              />
            </div>

            {/* 3. New Registrations */}
            <div className="metric-input-card bg-white hover:border-emerald-300">
              <div className="flex items-center gap-2 text-slate-500">
                <div className="w-6 h-6 rounded-md bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                  <Users size={13} />
                </div>
                <span className="text-xs font-semibold truncate">Registrations</span>
              </div>
              <input
                type="number"
                placeholder="0"
                value={metrics.new_registrations}
                onChange={(e) => handleMetricChange('new_registrations', e.target.value)}
                className="w-full text-xl sm:text-2xl font-extrabold text-slate-900 bg-transparent border-0 focus:outline-hidden p-0 tracking-tight"
              />
            </div>

            {/* 4. Job Applications */}
            <div className="metric-input-card bg-white hover:border-emerald-300">
              <div className="flex items-center gap-2 text-slate-500">
                <div className="w-6 h-6 rounded-md bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                  <Briefcase size={13} />
                </div>
                <span className="text-xs font-semibold truncate">Applications</span>
              </div>
              <input
                type="number"
                placeholder="0"
                value={metrics.job_applications}
                onChange={(e) => handleMetricChange('job_applications', e.target.value)}
                className="w-full text-xl sm:text-2xl font-extrabold text-slate-900 bg-transparent border-0 focus:outline-hidden p-0 tracking-tight"
              />
            </div>

            {/* 5. Shortlisted */}
            <div className="metric-input-card bg-white hover:border-emerald-300">
              <div className="flex items-center gap-2 text-slate-500">
                <div className="w-6 h-6 rounded-md bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                  <UserCheck size={13} />
                </div>
                <span className="text-xs font-semibold truncate">Shortlisted</span>
              </div>
              <input
                type="number"
                placeholder="0"
                value={metrics.candidates_shortlisted}
                onChange={(e) => handleMetricChange('candidates_shortlisted', e.target.value)}
                className="w-full text-xl sm:text-2xl font-extrabold text-slate-900 bg-transparent border-0 focus:outline-hidden p-0 tracking-tight"
              />
            </div>

            {/* 6. Interviews Conducted */}
            <div className="metric-input-card bg-white hover:border-emerald-300">
              <div className="flex items-center gap-2 text-slate-500">
                <div className="w-6 h-6 rounded-md bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                  <Video size={13} />
                </div>
                <span className="text-xs font-semibold truncate">Interviews</span>
              </div>
              <input
                type="number"
                placeholder="0"
                value={metrics.interviews_conducted}
                onChange={(e) => handleMetricChange('interviews_conducted', e.target.value)}
                className="w-full text-xl sm:text-2xl font-extrabold text-slate-900 bg-transparent border-0 focus:outline-hidden p-0 tracking-tight"
              />
            </div>

            {/* 7. Candidates Hired */}
            <div className="metric-input-card bg-white hover:border-emerald-300">
              <div className="flex items-center gap-2 text-slate-500">
                <div className="w-6 h-6 rounded-md bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                  <CheckCircle2 size={13} />
                </div>
                <span className="text-xs font-semibold truncate">Hired</span>
              </div>
              <input
                type="number"
                placeholder="0"
                value={metrics.candidates_hired}
                onChange={(e) => handleMetricChange('candidates_hired', e.target.value)}
                className="w-full text-xl sm:text-2xl font-extrabold text-slate-900 bg-transparent border-0 focus:outline-hidden p-0 tracking-tight"
              />
            </div>

            {/* 8. Profile Completions */}
            <div className="metric-input-card bg-white hover:border-emerald-300">
              <div className="flex items-center gap-2 text-slate-500">
                <div className="w-6 h-6 rounded-md bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                  <UserPlus size={13} />
                </div>
                <span className="text-xs font-semibold truncate">Profile Completions</span>
              </div>
              <input
                type="number"
                placeholder="0"
                value={metrics.profile_completions}
                onChange={(e) => handleMetricChange('profile_completions', e.target.value)}
                className="w-full text-xl sm:text-2xl font-extrabold text-slate-900 bg-transparent border-0 focus:outline-hidden p-0 tracking-tight"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Middle Section: 2-Column Dashboard Layout (Option D) */}
      <section className="reports-section-block">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column (Work & Progress + Action Items) - 7 cols */}
          <div className="lg:col-span-7 space-y-6">
            {/* 2. Today's Work & Progress */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <span className="reports-number-badge">2</span>
                  <h2 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
                    Today's Work & Progress
                  </h2>
                </div>

                {/* Progress Bar & Counter (Option D Signature) */}
                <div className="flex items-center gap-2.5">
                  <span className="text-xs font-medium text-slate-500">
                    <strong className="text-slate-900">{completedWorkCount}</strong> of {workProgress.length} completed
                  </span>
                  <div className="w-24 sm:w-32 bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                      style={{ width: `${workProgressPct}%` }}
                    />
                  </div>
                  <span className="text-xs font-extrabold text-emerald-600 w-8 text-right">
                    {workProgressPct}%
                  </span>
                </div>
              </div>

              {/* Checklist Items */}
              <div className="divide-y divide-slate-100 mt-2">
                {workProgress.map((item) => (
                  <div
                    key={item.id}
                    className={`py-3 transition flex items-center justify-between gap-3 ${
                      item.checked ? 'bg-slate-50/30' : 'bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {/* Custom Green Checkbox */}
                      <button
                        type="button"
                        onClick={() => toggleWorkItem(item.id)}
                        className={`w-4.5 h-4.5 rounded-md border flex items-center justify-center transition shrink-0 cursor-pointer ${
                          item.checked
                            ? 'bg-emerald-500 border-emerald-500 text-white'
                            : 'border-slate-300 bg-white hover:border-emerald-400'
                        }`}
                      >
                        {item.checked && <Check size={11} strokeWidth={3} />}
                      </button>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs sm:text-[13px] font-semibold ${item.checked ? 'text-slate-900' : 'text-slate-600'}`}>
                            {item.label}
                          </span>
                        </div>
                        <input
                          type="text"
                          value={item.note || ''}
                          placeholder="Details or updates (e.g. Monitored active requisitions)..."
                          onChange={(e) => updateWorkNote(item.id, e.target.value)}
                          className="w-full text-xs text-slate-500 hover:text-slate-800 focus:text-slate-900 bg-transparent border-0 focus:outline-hidden p-0 mt-0.5 truncate"
                        />
                      </div>
                    </div>

                    <ChevronRight size={14} className="text-slate-300 shrink-0" />
                  </div>
                ))}
              </div>
            </div>

            {/* 3. Next Steps / Action Items */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs">
              <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <span className="reports-number-badge">3</span>
                  <h2 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
                    Next Steps / Action Items
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={addActionItem}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold transition cursor-pointer"
                >
                  <Plus size={12} strokeWidth={2.5} />
                  <span>Add Task</span>
                </button>
              </div>

              <div className="divide-y divide-slate-100 mt-2">
                {actionItems.map((item) => (
                  <div
                    key={item.id}
                    className={`py-3 transition flex items-center justify-between gap-3 ${
                      item.completed ? 'opacity-60' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <button
                        type="button"
                        onClick={() => toggleActionItem(item.id)}
                        className={`w-4.5 h-4.5 rounded-md border flex items-center justify-center transition shrink-0 cursor-pointer ${
                          item.completed
                            ? 'bg-emerald-500 border-emerald-500 text-white'
                            : 'border-slate-300 bg-white hover:border-emerald-400'
                        }`}
                      >
                        {item.completed && <Check size={11} strokeWidth={3} />}
                      </button>

                      <input
                        type="text"
                        value={item.task}
                        placeholder="Task description..."
                        onChange={(e) =>
                          setActionItems((prev) =>
                            prev.map((a) => (a.id === item.id ? { ...a, task: e.target.value } : a))
                          )
                        }
                        className={`text-xs sm:text-[13px] font-semibold bg-transparent border-0 focus:outline-hidden w-full ${
                          item.completed ? 'line-through text-slate-400' : 'text-slate-900'
                        }`}
                      />
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600">
                        {item.assignee || 'Operations'}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          item.priority === 'High'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200/60'
                            : item.priority === 'Medium'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200/60'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {item.priority || 'Normal'}
                      </span>
                      <span className="text-[11px] text-slate-400 hidden sm:inline">
                        {item.deadline || 'Upcoming'}
                      </span>
                      <button
                        type="button"
                        onClick={() => setActionItems((prev) => prev.filter((a) => a.id !== item.id))}
                        className="p-1 hover:text-rose-600 text-slate-300 rounded cursor-pointer"
                        title="Delete task"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column (Content & Marketing + Observations) - 5 cols */}
          <div className="lg:col-span-5 space-y-6">
            {/* 4. Content & Marketing Activity with Visual Bar Chart */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs">
              <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-md bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <BarChart2 size={13} />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                    Content & Marketing Activity
                  </h3>
                </div>

                <button
                  type="button"
                  onClick={handleOpenAddActivity}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition shadow-2xs cursor-pointer"
                >
                  <Plus size={12} strokeWidth={2.5} />
                  <span>Add Activity</span>
                </button>
              </div>

              {/* Option D Mini Visual Bar Chart */}
              <div className="pt-4 pb-2">
                <div className="flex items-end justify-between h-20 px-2 gap-2">
                  {[
                    { day: 'Mon', h: '35%' },
                    { day: 'Tue', h: '55%' },
                    { day: 'Wed', h: '75%' },
                    { day: 'Thu', h: '100%' },
                    { day: 'Fri', h: '60%' },
                    { day: 'Sat', h: '25%' },
                    { day: 'Sun', h: '15%' },
                  ].map((bar, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center h-full justify-end gap-1.5">
                      <div className="w-full bg-slate-100 rounded-t-sm h-full flex items-end">
                        <div
                          className="w-full bg-gradient-to-t from-emerald-600 to-emerald-400 rounded-t-sm transition-all duration-500 hover:brightness-110"
                          style={{ height: bar.h }}
                        />
                      </div>
                      <span className="text-[10px] font-semibold text-slate-400">{bar.day}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Activities Content */}
              {marketingActivities.length === 0 ? (
                <div className="mt-3 p-4 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                  <p className="text-xs font-semibold text-slate-600">No marketing activities logged for this date.</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Add campaigns, ads, reels, or posts.</p>
                </div>
              ) : (
                <div className="mt-3 divide-y divide-slate-100">
                  {marketingActivities.map((act) => (
                    <div key={act.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <ChannelIcon channel={act.platform} size={15} />
                        <div className="truncate">
                          <span className="font-bold text-slate-900 block truncate">{act.title}</span>
                          <span className="text-[10px] text-slate-400">
                            Spend: ₹{Number(act.spend || 0).toLocaleString()} · Reach: {Number(act.reach || 0).toLocaleString()}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleEditActivity(act)}
                          className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded cursor-pointer"
                        >
                          <Edit3 size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteActivity(act.id)}
                          className="p-1 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 5. Observations & Insights in Soft Emerald Tint */}
            <div className="bg-emerald-50/40 border border-emerald-200/80 rounded-2xl p-5 shadow-2xs">
              <div className="flex items-center justify-between pb-3 border-b border-emerald-100">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-md bg-emerald-100 text-emerald-700 flex items-center justify-center">
                    <Lightbulb size={13} />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                    Observations & Insights
                  </h3>
                </div>

                <button
                  type="button"
                  onClick={() => setShowObsTextareas(!showObsTextareas)}
                  className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 cursor-pointer"
                >
                  {showObsTextareas ? 'Done Editing' : 'Edit Notes'}
                </button>
              </div>

              {/* Option D Bullet Display */}
              {!showObsTextareas ? (
                <div className="mt-3.5 space-y-2">
                  {observationBullets.map((bullet, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-xs text-slate-700 leading-relaxed">
                      <span className="text-emerald-600 font-bold text-sm leading-none mt-0.5">•</span>
                      <span>{bullet}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-3.5 space-y-3">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-emerald-900 mb-1">
                      What went well today?
                    </label>
                    <textarea
                      rows={3}
                      value={observations.what_went_well || ''}
                      onChange={(e) => setObservations({ ...observations, what_went_well: e.target.value })}
                      placeholder="e.g. 2 vacancies posted across tech and non-tech categories..."
                      className="w-full text-xs text-slate-800 bg-white border border-emerald-200 rounded-xl p-2.5 focus:ring-2 focus:ring-emerald-500/20 focus:outline-hidden leading-relaxed shadow-2xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-amber-900 mb-1">
                      Issues / Roadblocks
                    </label>
                    <textarea
                      rows={3}
                      value={observations.issues_faced || ''}
                      onChange={(e) => setObservations({ ...observations, issues_faced: e.target.value })}
                      placeholder="Candidate drop-offs, queries, or pending items..."
                      className="w-full text-xs text-slate-800 bg-white border border-amber-200 rounded-xl p-2.5 focus:ring-2 focus:ring-amber-500/20 focus:outline-hidden leading-relaxed shadow-2xs"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Activity Add/Edit Modal */}
      {showActivityModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-extrabold text-slate-900 text-base">
                {editingActivity ? 'Edit Marketing Activity' : 'Add Content & Marketing Activity'}
              </h3>
              <button
                type="button"
                onClick={() => setShowActivityModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveActivityModal} className="mt-4 space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Platform</label>
                  <select
                    value={activityForm.platform}
                    onChange={(e) => setActivityForm({ ...activityForm, platform: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="Instagram">Instagram</option>
                    <option value="LinkedIn">LinkedIn</option>
                    <option value="YouTube">YouTube</option>
                    <option value="Facebook">Facebook</option>
                    <option value="Google Ads">Google Ads</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Content Type</label>
                  <select
                    value={activityForm.content_type}
                    onChange={(e) => setActivityForm({ ...activityForm, content_type: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="Post">Post</option>
                    <option value="Post (Boosted)">Post (Boosted)</option>
                    <option value="Reel">Reel</option>
                    <option value="Story">Story</option>
                    <option value="Video">Video</option>
                    <option value="Advertisement">Advertisement</option>
                    <option value="Campaign">Campaign</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Campaign / Content Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Contract Hiring Guide for Tech Roles"
                  value={activityForm.title}
                  onChange={(e) => setActivityForm({ ...activityForm, title: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Description / Goal</label>
                <input
                  type="text"
                  placeholder="Target audience, hook, or purpose..."
                  value={activityForm.description}
                  onChange={(e) => setActivityForm({ ...activityForm, description: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Spend (₹)</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={activityForm.spend}
                    onChange={(e) => setActivityForm({ ...activityForm, spend: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Reach / Impr.</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={activityForm.reach}
                    onChange={(e) => setActivityForm({ ...activityForm, reach: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Clicks</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={activityForm.clicks}
                    onChange={(e) => setActivityForm({ ...activityForm, clicks: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Registrations Generated</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={activityForm.registrations}
                    onChange={(e) => setActivityForm({ ...activityForm, registrations: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Applications Generated</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={activityForm.applications}
                    onChange={(e) => setActivityForm({ ...activityForm, applications: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowActivityModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
                >
                  {editingActivity ? 'Save Changes' : 'Add Activity'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Past Reports History Drawer */}
      {showHistoryDrawer && (
        <div className="fixed inset-0 z-50 bg-slate-900/30 backdrop-blur-xs flex justify-end">
          <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col border-l border-slate-200 animate-slide-left">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History size={18} className="text-emerald-600" />
                <h3 className="font-extrabold text-slate-900 text-sm">Past Reports Archive</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowHistoryDrawer(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 flex-1 overflow-y-auto space-y-2.5">
              {pastReportsList.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-8">No historical reports found yet.</p>
              ) : (
                pastReportsList.map((rep) => (
                  <div
                    key={rep.id}
                    onClick={() => {
                      setReportDate(rep.report_date);
                      setReportType(rep.report_type || 'daily');
                      setShowHistoryDrawer(false);
                    }}
                    className={`p-3.5 rounded-xl border transition cursor-pointer hover:border-emerald-300 hover:bg-emerald-50/20 ${
                      rep.report_date === reportDate && rep.report_type === reportType
                        ? 'border-emerald-600 bg-emerald-50/40'
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-slate-900">
                        {rep.report_date}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                          rep.status === 'submitted' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {rep.status}
                      </span>
                    </div>
                    <div className="mt-1 text-[11px] text-slate-500 flex items-center justify-between">
                      <span>Type: <strong className="capitalize">{rep.report_type}</strong></span>
                      <span>By: {rep.author_name || 'Team Member'}</span>
                    </div>
                    {rep.metrics && (
                      <div className="mt-2 text-[10px] text-slate-400 flex items-center gap-3">
                        <span>Companies: <strong>{rep.metrics.companies_onboarded || 0}</strong></span>
                        <span>Visitors: <strong>{rep.metrics.website_visitors || 0}</strong></span>
                        <span>Regs: <strong>{rep.metrics.new_registrations || 0}</strong></span>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
