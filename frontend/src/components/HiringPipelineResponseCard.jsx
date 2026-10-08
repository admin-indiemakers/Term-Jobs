import React, { useState } from 'react';
import {
  Briefcase,
  Users,
  Calendar,
  Clock,
  Sparkles,
  Plus,
  CheckCircle2,
  FileText,
  Radio,
  Edit3,
  User,
  CreditCard,
  ChevronRight,
  BarChart2
} from 'lucide-react';

/**
 * Parser helper to detect and extract hiring pipeline summary data
 * from raw AI assistant text or tool execution results.
 */
export function parseHiringPipelineData(text, executedActions = []) {
  if (!text && (!executedActions || !executedActions.length)) return null;

  const statsAction = executedActions?.find(
    (a) => a.tool === 'get_hiring_manager_stats' || a.tool === 'get_company_admin_stats'
  );
  const actionRes = statsAction?.result;

  const raw = String(text || '');
  const hasPipelineKeywords =
    /pipeline overview/i.test(raw) ||
    /hiring pipeline/i.test(raw) ||
    (/requisitions?:/i.test(raw) && /candidates/i.test(raw) && /interviews/i.test(raw));

  if (!hasPipelineKeywords && !actionRes) return null;

  // Extract subtitle/company from "Your Hiring Pipeline Overview – Asimovx" or "– Sreehari (Asimovx)"
  let title = 'Hiring Pipeline Overview';
  let subtitle = 'Asimovx';
  const titleMatch = raw.match(/(?:Your\s+)?Hiring\s+Pipeline\s+Overview\s*[–—-]\s*([^\n\r📊📈]+)/i);
  if (titleMatch) {
    subtitle = titleMatch[1].replace(/\*+/g, '').trim();
  }

  // Extract Requisitions
  const totalReqsMatch = raw.match(/Total\s+Requisitions[:\s*]*(\d+)/i);
  const liveReqsMatch = raw.match(/Live\s+Requisitions[:\s*]*(\d+)/i);
  const draftReqsMatch = raw.match(/Draft\s+Requisitions[:\s*]*(\d+)/i);

  // Extract Candidates (handles "4️⃣ Shortlisted Candidates: 0", "• Shortlisted Candidates: 0", etc.)
  const shortlistedMatch = raw.match(/Shortlisted(?:\s+Candidates)?[:\s*]*(\d+)/i);
  const acceptedMatch = raw.match(/Accepted(?:\s*\([^)]*\))?(?:\s+Candidates)?[:\s*]*(\d+)/i);
  const onboardingMatch = raw.match(/Onboarding(?:\s+Candidates)?[:\s*]*(\d+)/i);

  // Extract Interviews & optional note e.g. "(you already have two interview slots set)"
  const interviewsMatch = raw.match(/Scheduled\s+Interviews[:\s*]*(\d+)/i);
  const interviewNoteMatch = raw.match(/Scheduled\s+Interviews[:\s*]*\d+\s*\(([^)]+)\)/i);

  // Extract Pending Items
  const timesheetsMatch = raw.match(/(?:Pending\s+)?Timesheets[:\s*]*(\d+)/i);
  const expensesMatch = raw.match(/(?:Pending\s+)?Expenses[:\s*]*(\d+)/i);

  const totalReqs = actionRes?.total_requisitions ?? (totalReqsMatch ? parseInt(totalReqsMatch[1], 10) : 0);
  const liveReqs = actionRes?.live_requisitions ?? (liveReqsMatch ? parseInt(liveReqsMatch[1], 10) : 0);
  const draftReqs = actionRes?.draft_requisitions ?? (draftReqsMatch ? parseInt(draftReqsMatch[1], 10) : 0);

  const shortlisted = actionRes?.shortlisted_candidates ?? (shortlistedMatch ? parseInt(shortlistedMatch[1], 10) : 0);
  const accepted = actionRes?.accepted_candidates ?? (acceptedMatch ? parseInt(acceptedMatch[1], 10) : 0);
  const onboarding = actionRes?.onboarding_candidates ?? (onboardingMatch ? parseInt(onboardingMatch[1], 10) : 0);

  const scheduledInterviews = actionRes?.scheduled_interviews ?? (interviewsMatch ? parseInt(interviewsMatch[1], 10) : 0);
  const interviewNote = interviewNoteMatch ? interviewNoteMatch[1].replace(/\*+/g, '').trim() : '';

  const pendingTimesheets = actionRes?.pending_timesheets ?? (timesheetsMatch ? parseInt(timesheetsMatch[1], 10) : 0);
  const pendingExpenses = actionRes?.pending_expenses ?? (expensesMatch ? parseInt(expensesMatch[1], 10) : 0);

  return {
    title,
    subtitle: (subtitle || actionRes?.tenant_id || 'Asimovx').replace(/\*+/g, '').trim(),
    totalReqs,
    liveReqs,
    draftReqs,
    shortlisted,
    accepted,
    onboarding,
    scheduledInterviews,
    interviewNote,
    pendingTimesheets,
    pendingExpenses,
    rawText: raw
  };
}

/**
 * Compact, modern Hiring Pipeline Overview Card
 */
export default function HiringPipelineResponseCard({
  data,
  timestamp = 'Just now',
  onSendMessage,
  onCopy
}) {
  const handleAction = (prompt) => {
    if (typeof onSendMessage === 'function') {
      onSendMessage(prompt);
    }
  };

  const cleanSubtitle = (data.subtitle || 'Asimovx').replace(/\*+/g, '').trim();

  return (
    <div className="w-full bg-white border-0 rounded-2xl rounded-tl-xs shadow-xs p-3.5 sm:p-4 space-y-2.5 text-gray-900 select-text transition-all relative overflow-hidden font-sans">
      {/* ── HEADER ────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-3 relative z-10 pb-0.5">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-[#111417] text-white flex items-center justify-center shrink-0 shadow-xs">
            <Briefcase size={16} strokeWidth={2.2} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-bold text-gray-950 tracking-tight leading-none">
                {data.title || 'Hiring Pipeline Overview'}
              </h2>
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[11px] font-semibold text-gray-700">{cleanSubtitle}</span>
              <span className="text-gray-300">•</span>
              <span className="text-[10.5px] text-gray-400 font-normal">
                Here’s the current status of your hiring pipeline.
              </span>
            </div>
          </div>
        </div>

        {/* Right side: Updated just now + sparkle */}
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-medium text-gray-500 bg-gray-50/90 border border-gray-200/70">
            <Clock size={10} className="text-gray-400" />
            <span>Updated just now</span>
          </div>
          <Sparkles size={14} className="text-gray-300" />
        </div>
      </div>

      {/* ── ROW 1: 4 TOP METRIC CARDS ──────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 relative z-10">
        {/* Card 1: Total Requisitions */}
        <div className="bg-white border border-gray-100 rounded-xl p-2.5 shadow-3xs flex flex-col justify-between relative overflow-hidden h-20">
          <div className="flex items-center gap-1.5 text-gray-600">
            <div className="w-5 h-5 rounded-md bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-700 shrink-0">
              <FileText size={11} />
            </div>
            <span className="text-[11px] font-medium text-gray-600 truncate">Total Requisitions</span>
          </div>
          <div className="text-xl font-bold text-gray-950 tracking-tight pl-0.5">
            {data.totalReqs}
          </div>
          {/* Subtle wave svg */}
          <svg className="absolute bottom-0 right-0 w-16 h-8 text-gray-100/70 pointer-events-none" viewBox="0 0 100 40" fill="currentColor">
            <path d="M0 35 Q 25 15, 50 30 T 100 15 L 100 40 L 0 40 Z" />
          </svg>
        </div>

        {/* Card 2: Live Requisitions */}
        <div className="bg-white border border-gray-100 rounded-xl p-2.5 shadow-3xs flex flex-col justify-between relative overflow-hidden h-20">
          <div className="flex items-center gap-1.5 text-gray-600">
            <div className="w-5 h-5 rounded-md bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-700 shrink-0">
              <Radio size={11} />
            </div>
            <span className="text-[11px] font-medium text-gray-600 truncate">Live Requisitions</span>
          </div>
          <div className="text-xl font-bold text-gray-950 tracking-tight pl-0.5">
            {data.liveReqs}
          </div>
          {/* Subtle wave svg */}
          <svg className="absolute bottom-0 right-0 w-16 h-8 text-gray-100/70 pointer-events-none" viewBox="0 0 100 40" fill="currentColor">
            <path d="M0 32 Q 25 20, 50 32 T 100 10 L 100 40 L 0 40 Z" />
          </svg>
        </div>

        {/* Card 3: Draft Requisitions */}
        <div className="bg-white border border-gray-100 rounded-xl p-2.5 shadow-3xs flex flex-col justify-between relative overflow-hidden h-20">
          <div className="flex items-center gap-1.5 text-gray-600">
            <div className="w-5 h-5 rounded-md bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-700 shrink-0">
              <Edit3 size={11} />
            </div>
            <span className="text-[11px] font-medium text-gray-600 truncate">Draft Requisitions</span>
          </div>
          <div className="text-xl font-bold text-gray-950 tracking-tight pl-0.5">
            {data.draftReqs}
          </div>
          {/* Subtle wave svg */}
          <svg className="absolute bottom-0 right-0 w-16 h-8 text-gray-100/70 pointer-events-none" viewBox="0 0 100 40" fill="currentColor">
            <path d="M0 36 Q 30 18, 60 30 T 100 18 L 100 40 L 0 40 Z" />
          </svg>
        </div>

        {/* Card 4: Scheduled Interviews */}
        <div className="bg-white border border-gray-100 rounded-xl p-2.5 shadow-3xs flex flex-col justify-between relative overflow-hidden h-20">
          <div className="flex items-center gap-1.5 text-gray-600">
            <div className="w-5 h-5 rounded-md bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-700 shrink-0">
              <Users size={11} />
            </div>
            <span className="text-[11px] font-medium text-gray-600 truncate">Scheduled Interviews</span>
          </div>
          <div className="text-xl font-bold text-gray-950 tracking-tight pl-0.5">
            {data.scheduledInterviews}
          </div>
          {/* Mini bars */}
          <div className="absolute bottom-2.5 right-2.5 flex items-end gap-1 h-5 pointer-events-none">
            <div className="w-1 h-2 bg-gray-200 rounded-xs" />
            <div className="w-1 h-3 bg-gray-200 rounded-xs" />
            <div className="w-1 h-4 bg-gray-300 rounded-xs" />
            <div className="w-1 h-5 bg-gray-300 rounded-xs" />
          </div>
        </div>
      </div>

      {/* ── ROW 2: CANDIDATE FLOW CARD ──────────────────────────── */}
      <div className="bg-white border border-gray-100 rounded-xl p-2.5 sm:p-3 shadow-3xs space-y-2 relative z-10">
        <div className="flex items-center gap-1.5 text-gray-800">
          <Briefcase size={12} className="text-gray-900" />
          <span className="text-[11px] font-bold text-gray-900 tracking-tight">Candidate Flow</span>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-1.5 sm:gap-2">
          {/* Step 1: Shortlisted */}
          <div className="bg-[#F6F8FA] hover:bg-[#F1F4F8] rounded-lg p-2 flex items-center gap-2.5 flex-1 w-full transition-colors">
            <div className="w-7 h-7 rounded-lg bg-white border border-gray-200/60 shadow-3xs flex items-center justify-center text-gray-700 shrink-0">
              <FileText size={13} />
            </div>
            <div>
              <div className="text-sm font-bold text-gray-950 leading-none">
                {data.shortlisted}
              </div>
              <div className="text-[10px] font-medium text-gray-500 mt-0.5">
                Shortlisted
              </div>
            </div>
          </div>

          <ChevronRight size={13} className="text-gray-300 shrink-0 hidden sm:block" />

          {/* Step 2: Accepted (Offer-Accepted) */}
          <div className="bg-[#F6F8FA] hover:bg-[#F1F4F8] rounded-lg p-2 flex items-center gap-2.5 flex-1 w-full transition-colors">
            <div className="w-7 h-7 rounded-lg bg-white border border-gray-200/60 shadow-3xs flex items-center justify-center text-gray-700 shrink-0">
              <CheckCircle2 size={13} />
            </div>
            <div>
              <div className="text-sm font-bold text-gray-950 leading-none">
                {data.accepted}
              </div>
              <div className="text-[10px] font-medium text-gray-500 mt-0.5">
                Accepted <span className="text-gray-400 font-normal">(Offer-Accepted)</span>
              </div>
            </div>
          </div>

          <ChevronRight size={13} className="text-gray-300 shrink-0 hidden sm:block" />

          {/* Step 3: Onboarding */}
          <div className="bg-[#F6F8FA] hover:bg-[#F1F4F8] rounded-lg p-2 flex items-center gap-2.5 flex-1 w-full transition-colors">
            <div className="w-7 h-7 rounded-lg bg-white border border-gray-200/60 shadow-3xs flex items-center justify-center text-gray-700 shrink-0">
              <User size={13} />
            </div>
            <div>
              <div className="text-sm font-bold text-gray-950 leading-none">
                {data.onboarding}
              </div>
              <div className="text-[10px] font-medium text-gray-500 mt-0.5">
                Onboarding
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── ROW 3: OTHER ACTIVITIES CARD ────────────────────────── */}
      <div className="bg-white border border-gray-100 rounded-xl p-2.5 sm:p-3 shadow-3xs space-y-2 relative z-10">
        <div className="flex items-center gap-1.5 text-gray-800">
          <BarChart2 size={12} className="text-gray-900" />
          <span className="text-[11px] font-bold text-gray-900 tracking-tight">Other Activities</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 divide-y md:divide-y-0 md:divide-x divide-gray-100">
          {/* Left: Pending Timesheets */}
          <div className="flex items-center gap-2.5 pt-0.5 md:pt-0">
            <div className="w-7 h-7 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-700 shrink-0">
              <Clock size={13} />
            </div>
            <div>
              <div className="text-sm font-bold text-gray-950 leading-none">
                {data.pendingTimesheets}
              </div>
              <div className="text-[10px] font-medium text-gray-500 mt-0.5">
                Pending Timesheets
              </div>
            </div>
          </div>

          {/* Right: Pending Expenses */}
          <div className="flex items-center gap-2.5 pt-2 md:pt-0 md:pl-4">
            <div className="w-7 h-7 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-700 shrink-0">
              <CreditCard size={13} />
            </div>
            <div>
              <div className="text-sm font-bold text-gray-950 leading-none">
                {data.pendingExpenses}
              </div>
              <div className="text-[10px] font-medium text-gray-500 mt-0.5">
                Pending Expenses
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── ROW 4: ACTION BAR ("What would you like to do next?") ─ */}
      <div className="bg-white border border-gray-100 rounded-xl p-2 sm:p-2.5 shadow-3xs flex flex-col md:flex-row items-center justify-between gap-2 relative z-10">
        <div className="flex items-center gap-1.5 text-gray-900 self-start md:self-center pl-0.5">
          <div className="w-5 h-5 rounded-full bg-gray-50 flex items-center justify-center text-gray-800 shrink-0">
            <Sparkles size={11} />
          </div>
          <span className="text-[11px] font-bold text-gray-900">What would you like to do next?</span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto justify-start md:justify-end">
          {/* Button 1: Create New Requisition */}
          <button
            type="button"
            onClick={() => handleAction('Create a new requisition')}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#111417] hover:bg-black text-white text-[11px] font-semibold transition-all shadow-3xs hover:scale-101 active:scale-98 cursor-pointer"
          >
            <Plus size={11} />
            <span>Create New Requisition</span>
          </button>

          {/* Button 2: View Shortlisted Candidates */}
          <button
            type="button"
            onClick={() => handleAction('List shortlisted candidates')}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white hover:bg-gray-50 text-gray-800 border border-gray-200 text-[11px] font-semibold transition-all shadow-3xs hover:scale-101 active:scale-98 cursor-pointer"
          >
            <Users size={11} className="text-gray-600" />
            <span>View Shortlisted Candidates</span>
          </button>

          {/* Button 3: Schedule More Interviews */}
          <button
            type="button"
            onClick={() => handleAction('Show scheduled interviews')}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white hover:bg-gray-50 text-gray-800 border border-gray-200 text-[11px] font-semibold transition-all shadow-3xs hover:scale-101 active:scale-98 cursor-pointer"
          >
            <Calendar size={11} className="text-gray-600" />
            <span>Schedule More Interviews</span>
          </button>
        </div>
      </div>
    </div>
  );
}
