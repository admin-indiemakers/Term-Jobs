/**
 * Utility to download reports and growth analytics as Excel (CSV with BOM) and PDF.
 */

export function exportToExcel(reportsInput = [], analytics = null, filename = null) {
  const reports = Array.isArray(reportsInput) ? reportsInput : (reportsInput ? [reportsInput] : []);
  const rows = [];

  // UTF-8 BOM so Excel opens with proper character encoding
  rows.push('\ufeff"TermJobs Reports & Growth Management Export"');
  rows.push(`"Exported At","${new Date().toLocaleString()}"`);
  rows.push('');

  // 1. Executive KPIs Summary
  if (analytics?.kpis) {
    rows.push('"--- EXECUTIVE KPI SUMMARY ---"');
    rows.push('"Metric","Current Value","Change vs Prior Period"');
    const kpis = analytics.kpis;
    for (const [key, item] of Object.entries(kpis)) {
      rows.push(`"${item.label || key}","${item.formatted || item.value}","${item.change?.value || '+0%'}"`);
    }
    rows.push('');
  }

  // 2. Detailed Reports Table
  rows.push('"--- DETAILED TEAM REPORTS ---"');
  rows.push([
    '"Report Date"',
    '"Report Type"',
    '"Status"',
    '"Companies Onboarded"',
    '"Website Visitors"',
    '"New Registrations"',
    '"Profile Completions"',
    '"Job Applications"',
    '"Shortlisted"',
    '"Interviews Conducted"',
    '"Candidates Hired"',
    '"Vacancies Posted"',
    '"Author"',
    '"Key Observations & Notes"',
  ].join(','));

  const sortedReports = [...reports].sort((a, b) => (a.report_date || '').localeCompare(b.report_date || ''));

  sortedReports.forEach((r) => {
    const m = r.metrics || {};
    const obs = r.observations || {};
    const notes = [
      obs.what_went_well ? `Well: ${obs.what_went_well.replace(/\n/g, ' ')}` : '',
      obs.issues_faced ? `Issues: ${obs.issues_faced.replace(/\n/g, ' ')}` : '',
      obs.why_candidates_not_applying ? `Drop-off: ${obs.why_candidates_not_applying.replace(/\n/g, ' ')}` : '',
      obs.company_feedback ? `Feedback: ${obs.company_feedback.replace(/\n/g, ' ')}` : '',
    ].filter(Boolean).join(' | ').replace(/"/g, '""');

    rows.push([
      `"${r.report_date || ''}"`,
      `"${r.report_type || 'daily'}"`,
      `"${r.status || 'draft'}"`,
      m.companies_onboarded ?? 0,
      m.website_visitors ?? 0,
      m.new_registrations ?? 0,
      m.profile_completions ?? 0,
      m.job_applications ?? 0,
      m.candidates_shortlisted ?? 0,
      m.interviews_conducted ?? 0,
      m.candidates_hired ?? 0,
      m.new_vacancies_posted ?? 0,
      `"${r.author_name || 'Team Member'}"`,
      `"${notes}"`,
    ].join(','));
  });

  rows.push('');

  // 3. Work Progress Milestones
  rows.push('"--- WORK & PROGRESS MILESTONES ---"');
  rows.push('"Date","Task Category / Label","Status","Details / Notes"');
  sortedReports.forEach((r) => {
    (r.work_progress || []).forEach((wp) => {
      if (wp.label || wp.note || wp.task) {
        rows.push([
          `"${r.report_date || ''}"`,
          `"${(wp.label || wp.category || '').replace(/"/g, '""')}"`,
          `"${wp.checked || wp.status === 'Completed' ? 'Completed' : 'Pending'}"`,
          `"${(wp.note || wp.task || '').replace(/"/g, '""')}"`,
        ].join(','));
      }
    });
  });

  rows.push('');

  // 4. Marketing Activities
  rows.push('"--- CONTENT & MARKETING ACTIVITIES ---"');
  rows.push('"Date","Platform","Content Type","Title / Campaign","Spend (INR)","Reach","Impressions","Clicks","Registrations","Applications"');
  sortedReports.forEach((r) => {
    (r.marketing_activities || []).forEach((act) => {
      rows.push([
        `"${r.report_date || ''}"`,
        `"${(act.platform || '').replace(/"/g, '""')}"`,
        `"${(act.content_type || '').replace(/"/g, '""')}"`,
        `"${(act.title || '').replace(/"/g, '""')}"`,
        act.spend ?? 0,
        act.reach ?? 0,
        act.impressions ?? 0,
        act.clicks ?? 0,
        act.registrations ?? 0,
        act.applications ?? 0,
      ].join(','));
    });
  });

  const csvContent = rows.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  const outName = filename || `TermJobs_Reports_Export_${new Date().toISOString().slice(0, 10)}.csv`;
  link.setAttribute('download', outName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportToPdf() {
  window.print();
}
