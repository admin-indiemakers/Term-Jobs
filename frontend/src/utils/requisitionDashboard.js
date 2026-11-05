const count = value => Number.isFinite(Number(value)) ? Math.max(0, Math.floor(Number(value))) : 0;

function calendarDay(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return null;
  const parsed = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) return null;
  return parsed.getTime() / 86400000;
}

export function indianCalendarDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const part = type => parts.find(item => item.type === type).value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function requisitionDashboard(rows, today = indianCalendarDate()) {
  const open = rows.filter(row => row.status === 'Published');
  const todayDay = calendarDay(today);
  const topRoles = rows.filter(row => count(row.applicants_count) > 0)
    .sort((a, b) => count(b.applicants_count) - count(a.applicants_count) || String(a.title).localeCompare(String(b.title)))
    .slice(0, 5);
  const closingSoon = open.flatMap(row => {
    const deadline = row.structured_role?.submission_deadline;
    const day = calendarDay(deadline);
    if (todayDay === null || day === null) return [];
    const daysLeft = day - todayDay;
    return daysLeft >= 0 && daysLeft <= 7 ? [{ ...row, daysLeft }] : [];
  }).sort((a, b) => a.daysLeft - b.daysLeft || String(a.title).localeCompare(String(b.title)));
  return {
    applications: rows.reduce((sum, row) => sum + count(row.applicants_count), 0),
    viewers: rows.reduce((sum, row) => sum + count(row.viewers_count), 0),
    open: open.length,
    closed: rows.filter(row => row.status === 'Closed').length,
    companies: new Set(rows.map(row => (row.company_name || '').trim().toLowerCase()).filter(Boolean)).size,
    awaitingApplicants: open.filter(row => count(row.applicants_count) === 0).length,
    topRoles,
    closingSoon,
  };
}
