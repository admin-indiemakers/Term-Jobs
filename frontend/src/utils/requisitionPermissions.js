export function canCreateRequisition(role) {
  return ['Hiring Manager', 'HR', 'Admin', 'Company Admin', 'Super Admin'].includes(role);
}

export function requisitionWorkflowRedirect(role, pathname) {
  const normalized = String(role || '').trim().toLowerCase();
  const home = ['finance', 'finance team'].includes(normalized)
    ? '/dashboard/finance'
    : ['procurement', 'procurement team', 'employee'].includes(normalized)
      ? '/dashboard/procurement' : null;
  if (!home) return null;
  if (/^\/dashboard\/(?:requisitions|hiring-manager)(?:\/|$)/.test(pathname)) return home;
  return null;
}
