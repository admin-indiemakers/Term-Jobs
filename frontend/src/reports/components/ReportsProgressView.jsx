import React, { useState, useEffect, useCallback } from 'react';
import { 
  Building2, 
  Users, 
  Briefcase, 
  UserCheck, 
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
  History, 
  Search, 
  Globe, 
  Video, 
  BarChart2, 
  FileText,
  HelpCircle,
  X
} from 'lucide-react';
import { ChannelIcon } from './ChannelIcons';
import { reportsApi } from '../services/reportsApi';

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
  { id: 'company_onboarding', label: 'Company onboarding & follow-up', checked: true, note: 'Onboarded 5 new client companies and followed up on hiring criteria' },
  { id: 'candidate_support', label: 'Candidate support / queries', checked: true, note: 'Resolved 18 candidate profile verification and interview room queries' },
  { id: 'product_updates', label: 'Product / platform updates', checked: false, note: 'AI interview role-awareness patch and browser back navigation protection' },
  { id: 'content_creation', label: 'Content creation & publishing', checked: true, note: 'Published interview prep guide and short video on AI screening' },
  { id: 'marketing_campaign', label: 'Marketing & campaign execution', checked: true, note: 'Active Instagram boosted post and LinkedIn outreach campaign' },
  { id: 'bug_fixes', label: 'Bug fixes & system testing', checked: false, note: '' },
  { id: 'other_work', label: 'Other work completed', checked: false, note: '' },
];

const DEFAULT_ACTION_ITEMS = [
  { id: '1', task: 'Follow up with 3 potential enterprise company leads', assignee: 'Sales Team', priority: 'High', deadline: 'Tomorrow', status: 'Pending', completed: false },
  { id: '2', task: 'Run a new content campaign (Interview tips & candidate guides)', assignee: 'Marketing', priority: 'Medium', deadline: 'In 2 days', status: 'Pending', completed: false },
  { id: '3', task: 'Improve application conversion email reminders for incomplete profiles', assignee: 'Product Team', priority: 'High', deadline: 'This Friday', status: 'In Progress', completed: false },
];

export function ReportsProgressView({ user, onReportSaved }) {
  const [reportType, setReportType] = useState('daily'); // 'daily' | 'weekly' | 'monthly'
  const [reportDate, setReportDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [reportStatus, setReportStatus] = useState('draft'); // 'draft' | 'submitted'
  const [currentReportId, setCurrentReportId] = useState(null);

  // Form State
  const [metrics, setMetrics] = useState(DEFAULT_METRICS);
  const [workProgress, setWorkProgress] = useState(DEFAULT_WORK_CHECKLIST);
  const [marketingActivities, setMarketingActivities] = useState([
    {
      id: 'act-1',
      platform: 'Instagram',
      content_type: 'Post (Boosted)',
      title: 'Job tips - Boosted for 2 days',
      description: 'Promoted contract developer tips targeting fresher & mid-tier tech candidates',
      spend: 1500,
      reach: 24680,
      impressions: 29500,
      clicks: 1240,
      engagement: 3200,
      leads: 0,
      registrations: 144,
      applications: 92,
    },
    {
      id: 'act-2',
      platform: 'LinkedIn',
      content_type: 'Post',
      title: 'New companies on TermJobs',
      description: 'Organic company announcement post highlighting verified hiring partners',
      spend: 0,
      reach: 8420,
      impressions: 10200,
      clicks: 412,
      engagement: 890,
      leads: 0,
      registrations: 58,
      applications: 41,
    },
    {
      id: 'act-3',
      platform: 'YouTube',
      content_type: 'Video',
      title: 'How AI Interview works',
      description: 'Short explainer walkthrough on WebRTC room, camera checks and automated evaluation',
      spend: 0,
      reach: 3960,
      impressions: 5100,
      clicks: 310,
      engagement: 540,
      leads: 128,
      registrations: 34,
      applications: 22,
    },
  ]);
  const [observations, setObservations] = useState({
    what_went_well: '• Strong response for the Instagram boosted post (24,680 reach, 1,240 clicks).\n• 5 new verified hiring partner companies onboarded smoothly.\n• Candidate speech recognition completed with zero packet drops.',
    issues_faced: '• 144 candidates registered but did not apply for active jobs.\n• Possible reasons: candidates exploring, or missing specific regional openings.\n• Action: send job recommendations & profile completion alerts.',
    why_candidates_not_applying: 'Looking for remote-only roles or entry-level non-technical listings.',
    why_visitors_leaving: 'Bounced on job details page without signing in.',
    company_feedback: 'Requested quicker turnaround on candidate shortlists.',
    improvements_needed: 'Streamline 1-click apply and add automated job alert notifications.',
  });
  const [actionItems, setActionItems] = useState(DEFAULT_ACTION_ITEMS);

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
        if (Array.isArray(rep.work_progress) && rep.work_progress.length > 0) {
          setWorkProgress(rep.work_progress);
        }
        if (Array.isArray(rep.marketing_activities)) {
          setMarketingActivities(rep.marketing_activities);
        }
        if (rep.observations) {
          setObservations(rep.observations);
        }
        if (Array.isArray(rep.action_items) && rep.action_items.length > 0) {
          setActionItems(rep.action_items);
        }
      } else {
        // Reset to clean default values for new entry
        setCurrentReportId(null);
        setReportStatus('draft');
        setMetrics(DEFAULT_METRICS);
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
        audit_note: submitStatus === 'submitted' ? 'Final report submitted' : 'Saved draft',
      };

      const res = await reportsApi.saveReport(payload);
      if (res?.report) {
        setCurrentReportId(res.report.id);
        setReportStatus(submitStatus);
        showToast(submitStatus === 'submitted' ? 'Report submitted successfully! Dashboard updated.' : 'Draft saved successfully.');
        if (onReportSaved) onReportSaved(res.report);
      }
    } catch (err) {
      console.error('Failed to save report:', err);
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

  const updateWorkNote = (id, note) => {
    setWorkProgress((prev) =>
      prev.map((item) => (item.id === id ? { ...item, note } : item))
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
      status: 'Pending',
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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-xl border border-slate-700 text-xs font-semibold animate-fade-in">
          <CheckCircle2 size={16} className="text-emerald-400" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Header Bar: Report Type Switcher, Date Selector & Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Reports & Progress
            </h1>
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                reportStatus === 'submitted'
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                  : 'bg-amber-100 text-amber-800 border border-amber-200'
              }`}
            >
              {reportStatus === 'submitted' ? 'Submitted' : 'Draft'}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Log your daily work, business metrics, marketing results, and strategic observations.
          </p>
        </div>

        {/* Date Selector & Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          {/* Sub-tabs: Daily Report / Weekly Summary / Monthly Summary */}
          <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1 border border-slate-200">
            <button
              type="button"
              onClick={() => setReportType('daily')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                reportType === 'daily' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Daily Report
            </button>
            <button
              type="button"
              onClick={() => setReportType('weekly')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                reportType === 'weekly' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Weekly Summary
            </button>
            <button
              type="button"
              onClick={() => setReportType('monthly')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                reportType === 'monthly' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Monthly Summary
            </button>
          </div>

          {/* Date Picker */}
          <div className="relative">
            <input
              type="date"
              value={reportDate}
              onChange={(e) => setReportDate(e.target.value)}
              className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 shadow-2xs focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            />
          </div>

          {/* History Button */}
          <button
            type="button"
            onClick={openHistoryDrawer}
            className="p-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 transition shadow-2xs cursor-pointer"
            title="View Past Reports"
          >
            <History size={16} />
          </button>

          {/* Save Draft Button */}
          <button
            type="button"
            disabled={saving}
            onClick={() => handleSave('draft')}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition cursor-pointer disabled:opacity-50"
          >
            <Save size={14} />
            <span>Save Draft</span>
          </button>

          {/* Submit Button */}
          <button
            type="button"
            disabled={saving}
            onClick={() => handleSave('submitted')}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs hover:shadow-sm transition cursor-pointer disabled:opacity-50"
          >
            <Send size={14} />
            <span>{saving ? 'Saving...' : 'Submit Report'}</span>
          </button>
        </div>
      </div>

      {/* 1. Today's Key Numbers (Business Metrics) */}
      <section className="reports-card p-6 bg-white border border-slate-200 rounded-2xl shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-50 text-indigo-600 text-xs font-extrabold">
              1
            </span>
            <h2 className="text-base font-bold text-slate-900">
              Today's Key Numbers
            </h2>
            <div className="group relative">
              <HelpCircle size={14} className="text-slate-400 hover:text-slate-600 cursor-pointer" />
              <div className="absolute left-0 bottom-full mb-1 hidden group-hover:block w-64 p-2 bg-slate-900 text-white text-[11px] rounded-lg shadow-lg z-20">
                Log today's platform operations numbers. The Growth Dashboard automatically aggregates these metrics over time.
              </div>
            </div>
          </div>
          <span className="text-xs text-slate-400 font-medium">All numbers saved to live growth analytics</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
          <div className="metric-input-card">
            <div className="flex items-center gap-2 text-slate-500 mb-1">
              <Building2 size={15} className="text-indigo-500" />
              <span className="text-xs font-semibold">Companies Onboarded</span>
            </div>
            <input
              type="number"
              placeholder="0"
              value={metrics.companies_onboarded}
              onChange={(e) => handleMetricChange('companies_onboarded', e.target.value)}
              className="w-full text-lg font-bold text-slate-900 bg-transparent border-0 focus:outline-hidden p-0"
            />
          </div>

          <div className="metric-input-card">
            <div className="flex items-center gap-2 text-slate-500 mb-1">
              <Globe size={15} className="text-blue-500" />
              <span className="text-xs font-semibold">Website Visitors</span>
            </div>
            <input
              type="number"
              placeholder="0"
              value={metrics.website_visitors}
              onChange={(e) => handleMetricChange('website_visitors', e.target.value)}
              className="w-full text-lg font-bold text-slate-900 bg-transparent border-0 focus:outline-hidden p-0"
            />
          </div>

          <div className="metric-input-card">
            <div className="flex items-center gap-2 text-slate-500 mb-1">
              <Users size={15} className="text-purple-500" />
              <span className="text-xs font-semibold">New Registrations</span>
            </div>
            <input
              type="number"
              placeholder="0"
              value={metrics.new_registrations}
              onChange={(e) => handleMetricChange('new_registrations', e.target.value)}
              className="w-full text-lg font-bold text-slate-900 bg-transparent border-0 focus:outline-hidden p-0"
            />
          </div>

          <div className="metric-input-card">
            <div className="flex items-center gap-2 text-slate-500 mb-1">
              <Briefcase size={15} className="text-emerald-500" />
              <span className="text-xs font-semibold">Job Applications</span>
            </div>
            <input
              type="number"
              placeholder="0"
              value={metrics.job_applications}
              onChange={(e) => handleMetricChange('job_applications', e.target.value)}
              className="w-full text-lg font-bold text-slate-900 bg-transparent border-0 focus:outline-hidden p-0"
            />
          </div>

          <div className="metric-input-card">
            <div className="flex items-center gap-2 text-slate-500 mb-1">
              <UserCheck size={15} className="text-teal-500" />
              <span className="text-xs font-semibold">Shortlisted</span>
            </div>
            <input
              type="number"
              placeholder="0"
              value={metrics.candidates_shortlisted}
              onChange={(e) => handleMetricChange('candidates_shortlisted', e.target.value)}
              className="w-full text-lg font-bold text-slate-900 bg-transparent border-0 focus:outline-hidden p-0"
            />
          </div>

          <div className="metric-input-card">
            <div className="flex items-center gap-2 text-slate-500 mb-1">
              <Video size={15} className="text-cyan-500" />
              <span className="text-xs font-semibold">Interviews Conducted</span>
            </div>
            <input
              type="number"
              placeholder="0"
              value={metrics.interviews_conducted}
              onChange={(e) => handleMetricChange('interviews_conducted', e.target.value)}
              className="w-full text-lg font-bold text-slate-900 bg-transparent border-0 focus:outline-hidden p-0"
            />
          </div>

          <div className="metric-input-card">
            <div className="flex items-center gap-2 text-slate-500 mb-1">
              <CheckCircle2 size={15} className="text-emerald-600" />
              <span className="text-xs font-semibold">Candidates Hired</span>
            </div>
            <input
              type="number"
              placeholder="0"
              value={metrics.candidates_hired}
              onChange={(e) => handleMetricChange('candidates_hired', e.target.value)}
              className="w-full text-lg font-bold text-slate-900 bg-transparent border-0 focus:outline-hidden p-0"
            />
          </div>

          <div className="metric-input-card">
            <div className="flex items-center gap-2 text-slate-500 mb-1">
              <BarChart2 size={15} className="text-amber-500" />
              <span className="text-xs font-semibold">Vacancies Posted</span>
            </div>
            <input
              type="number"
              placeholder="0"
              value={metrics.new_vacancies_posted}
              onChange={(e) => handleMetricChange('new_vacancies_posted', e.target.value)}
              className="w-full text-lg font-bold text-slate-900 bg-transparent border-0 focus:outline-hidden p-0"
            />
          </div>

          <div className="metric-input-card">
            <div className="flex items-center gap-2 text-slate-500 mb-1">
              <UserCheck size={15} className="text-indigo-400" />
              <span className="text-xs font-semibold">Profile Completions</span>
            </div>
            <input
              type="number"
              placeholder="0"
              value={metrics.profile_completions}
              onChange={(e) => handleMetricChange('profile_completions', e.target.value)}
              className="w-full text-lg font-bold text-slate-900 bg-transparent border-0 focus:outline-hidden p-0"
            />
          </div>
        </div>
      </section>

      {/* 2. Today's Work & Progress */}
      <section className="reports-card p-6 bg-white border border-slate-200 rounded-2xl shadow-xs">
        <div className="flex items-center gap-2 mb-4">
          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-50 text-indigo-600 text-xs font-extrabold">
            2
          </span>
          <h2 className="text-base font-bold text-slate-900">
            Today's Work & Progress
          </h2>
        </div>

        <div className="space-y-3">
          {workProgress.map((item) => (
            <div
              key={item.id}
              className={`p-3.5 rounded-xl border transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                item.checked ? 'bg-indigo-50/40 border-indigo-100' : 'bg-slate-50/50 border-slate-200'
              }`}
            >
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={Boolean(item.checked)}
                  onChange={() => toggleWorkItem(item.id)}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 cursor-pointer"
                />
                <span className={`text-xs sm:text-sm font-semibold ${item.checked ? 'text-slate-900' : 'text-slate-600'}`}>
                  {item.label}
                </span>
              </label>

              <input
                type="text"
                value={item.note || ''}
                placeholder="Details, e.g., AI interview updates, bug fixes, outreach"
                onChange={(e) => updateWorkNote(item.id, e.target.value)}
                className="w-full sm:w-2/3 px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              />
            </div>
          ))}
        </div>
      </section>

      {/* 3. Content & Marketing Activity Table */}
      <section className="reports-card p-6 bg-white border border-slate-200 rounded-2xl shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-50 text-indigo-600 text-xs font-extrabold">
              3
            </span>
            <h2 className="text-base font-bold text-slate-900">
              Content & Marketing Activity
            </h2>
          </div>

          <button
            type="button"
            onClick={handleOpenAddActivity}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition shadow-2xs cursor-pointer"
          >
            <Plus size={14} />
            <span>Add Activity</span>
          </button>
        </div>

        {marketingActivities.length === 0 ? (
          <div className="p-8 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
            <Globe size={28} className="mx-auto text-slate-300 mb-2" />
            <p className="text-xs font-semibold text-slate-600">No marketing activities logged for this date.</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Click "Add Activity" to log campaigns, ads, or posts.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left reports-table">
              <thead className="bg-slate-50">
                <tr>
                  <th>Platform</th>
                  <th>Type</th>
                  <th>Activity / Details</th>
                  <th>Spend</th>
                  <th>Results (Reach / Clicks / Regs)</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {marketingActivities.map((act) => (
                  <tr key={act.id}>
                    <td className="font-semibold text-slate-900">
                      <div className="flex items-center gap-2">
                        <ChannelIcon channel={act.platform} size={15} />
                        <span>{act.platform}</span>
                      </div>
                    </td>
                    <td>
                      <span className="inline-block px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-700">
                        {act.content_type}
                      </span>
                    </td>
                    <td>
                      <div className="font-semibold text-slate-900">{act.title}</div>
                      {act.description && <div className="text-[11px] text-slate-400 truncate max-w-xs">{act.description}</div>}
                    </td>
                    <td className="font-bold text-slate-900">
                      {act.spend ? `₹${Number(act.spend).toLocaleString()}` : '₹0'}
                    </td>
                    <td>
                      <div className="text-xs text-slate-700 font-medium">
                        Reach: <span className="font-bold text-slate-900">{Number(act.reach || 0).toLocaleString()}</span>
                        {' · '}
                        Clicks: <span className="font-bold text-slate-900">{Number(act.clicks || 0).toLocaleString()}</span>
                        {act.registrations ? (
                          <>
                            {' · '}
                            Regs: <span className="font-bold text-indigo-600">{act.registrations}</span>
                          </>
                        ) : null}
                      </div>
                    </td>
                    <td className="text-right space-x-2">
                      <button
                        type="button"
                        onClick={() => handleEditActivity(act)}
                        className="p-1 hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded transition cursor-pointer"
                        title="Edit activity"
                      >
                        <Edit3 size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteActivity(act.id)}
                        className="p-1 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded transition cursor-pointer"
                        title="Delete activity"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 4. Observations & Insights */}
      <section className="reports-card p-6 bg-white border border-slate-200 rounded-2xl shadow-xs">
        <div className="flex items-center gap-2 mb-4">
          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-50 text-indigo-600 text-xs font-extrabold">
            4
          </span>
          <h2 className="text-base font-bold text-slate-900">
            Observations & Insights
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl border border-emerald-100 bg-emerald-50/20">
            <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-800 mb-2">
              What went well today?
            </h3>
            <textarea
              rows={4}
              value={observations.what_went_well || ''}
              onChange={(e) => setObservations({ ...observations, what_went_well: e.target.value })}
              placeholder="Good responses, milestone achievements, successful onboarding..."
              className="w-full text-xs text-slate-800 bg-white border border-slate-200 rounded-lg p-3 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
            />
          </div>

          <div className="p-4 rounded-xl border border-amber-100 bg-amber-50/20">
            <h3 className="text-xs font-bold uppercase tracking-wider text-amber-800 mb-2">
              Issues / Why candidates didn't apply?
            </h3>
            <textarea
              rows={4}
              value={observations.issues_faced || ''}
              onChange={(e) => setObservations({ ...observations, issues_faced: e.target.value })}
              placeholder="Candidate feedback, drop-off reasons, technical bottlenecks, hiring partner queries..."
              className="w-full text-xs text-slate-800 bg-white border border-slate-200 rounded-lg p-3 focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
            />
          </div>
        </div>
      </section>

      {/* 5. Next Steps / Action Items */}
      <section className="reports-card p-6 bg-white border border-slate-200 rounded-2xl shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-50 text-indigo-600 text-xs font-extrabold">
              5
            </span>
            <h2 className="text-base font-bold text-slate-900">
              Next Steps / Action Items
            </h2>
          </div>

          <button
            type="button"
            onClick={addActionItem}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold transition cursor-pointer"
          >
            <Plus size={14} />
            <span>Add Task</span>
          </button>
        </div>

        <div className="space-y-2.5">
          {actionItems.map((item) => (
            <div
              key={item.id}
              className={`p-3 rounded-xl border transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                item.completed ? 'bg-slate-50 border-slate-200 opacity-60' : 'bg-white border-slate-200 shadow-2xs'
              }`}
            >
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <input
                  type="checkbox"
                  checked={Boolean(item.completed)}
                  onChange={() => toggleActionItem(item.id)}
                  className="w-4 h-4 rounded text-indigo-600 border-slate-300 cursor-pointer"
                />
                <input
                  type="text"
                  value={item.task}
                  onChange={(e) =>
                    setActionItems((prev) =>
                      prev.map((a) => (a.id === item.id ? { ...a, task: e.target.value } : a))
                    )
                  }
                  className={`text-xs sm:text-sm font-semibold bg-transparent border-0 focus:outline-hidden w-full ${
                    item.completed ? 'line-through text-slate-500' : 'text-slate-900'
                  }`}
                />
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700">
                  {item.assignee || 'Operations'}
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    item.priority === 'High'
                      ? 'bg-rose-50 text-rose-700'
                      : item.priority === 'Medium'
                      ? 'bg-amber-50 text-amber-700'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {item.priority || 'Normal'}
                </span>
                <span className="text-[11px] text-slate-400 font-medium">
                  {item.deadline || 'Upcoming'}
                </span>
                <button
                  type="button"
                  onClick={() => setActionItems((prev) => prev.filter((a) => a.id !== item.id))}
                  className="p-1 hover:text-rose-600 text-slate-300 rounded cursor-pointer"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
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
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
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
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
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
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Description / Goal</label>
                <input
                  type="text"
                  placeholder="Target audience, hook, or purpose..."
                  value={activityForm.description}
                  onChange={(e) => setActivityForm({ ...activityForm, description: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
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
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Reach / Impr.</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={activityForm.reach}
                    onChange={(e) => setActivityForm({ ...activityForm, reach: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Clicks</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={activityForm.clicks}
                    onChange={(e) => setActivityForm({ ...activityForm, clicks: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
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
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Applications Generated</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={activityForm.applications}
                    onChange={(e) => setActivityForm({ ...activityForm, applications: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
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
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
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
                <History size={18} className="text-indigo-600" />
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
                    className={`p-3.5 rounded-xl border transition cursor-pointer hover:border-indigo-300 hover:bg-indigo-50/20 ${
                      rep.report_date === reportDate && rep.report_type === reportType
                        ? 'border-indigo-600 bg-indigo-50/40'
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
