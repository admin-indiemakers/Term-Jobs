import { financeRedirect, isFinanceRole } from './financeAccess.js';
// Notification payloads may contain legacy links. Keep clicks inside known portal routes.
const destinations = [
  /^\/dashboard\/hiring-manager(?:\/chat)?\/?$/,
  /^\/dashboard\/candidates\/(?:accepted|onboarding|portal-access|issues)\/?$/,
  /^\/dashboard(?:\/superadmin(?:\/(?:candidate-management|candidates|candidate-pool|candidatepool|candidates-pool|chat|onboard|onboard-vendor|accounts|vendor-accounts|admin-accounts|admins|outreach|candidate-outreach|billing|candidate-billing|archives))?)?\/?$/,
  /^\/dashboard\/requisitions(?:\/(?:[^/]+)(?:\/candidates(?:\/[^/]+)?)?)?\/?$/,
  /^\/dashboard\/workforce\/(?:team|timesheets|expenses|workers)\/?$/,
  /^\/dashboard\/admin(?:\/(?:chat|directors|hiring-managers|team|procurement|finance|profile|partner-vendors|vendors))?\/?$/,
  /^\/dashboard\/director(?:\/(?:requisitions|work-orders|finance-approvals|agreements|templates|profile))?\/?$/,
  /^\/dashboard\/recruiter(?:\/(?:requisitions|agreements|billing|workers|accepted|portal-access))?\/?$/,
  /^\/dashboard\/finance(?:\/(?:work-orders|approvals|profile))?\/?$/,
  /^\/dashboard\/procurement(?:\/(?:sow|finance-approvals))?\/?$/,
];

export function notificationDestination(notification, role) {
  const supplied = notification.data?.link;
  if (supplied) {
    if (typeof supplied !== 'string' || !supplied.startsWith('/dashboard') || /[\\\u0000-\u0020]/.test(supplied)) return null;
    try {
      const url = new URL(supplied, 'https://portal.invalid');
      const path = decodeURIComponent(url.pathname);
      if (url.origin !== 'https://portal.invalid' || path.includes('..') || !destinations.some((pattern) => pattern.test(path))) return null;
      if (['Hiring Manager', 'HR'].includes(role)
        && !/^\/dashboard\/(?:hiring-manager(?:\/chat)?|requisitions(?:\/.*)?|workforce\/(?:team|timesheets|expenses|workers)|candidates\/(?:accepted|onboarding|portal-access|issues))\/?$/.test(path)) return null;
      if (role === 'Admin' && !/^\/dashboard\/admin(?:\/(?:chat|directors|hiring-managers|team|procurement|finance|profile|partner-vendors|vendors))?\/?$/.test(path)) return null;
      if (financeRedirect(role, path)) return null;
      return `${url.pathname}${url.search}${url.hash}`;
    } catch {
      return null;
    }
  }
  const type = String(notification.type || '').toLowerCase();
  if (isFinanceRole(role)) {
    return /payment|billing|sow|work_order/.test(type) ? '/dashboard/finance' : null;
  }
  if (role === 'Admin') {
    if (type.includes('director')) return '/dashboard/admin/directors';
    if (/hiring.manager/.test(type)) return '/dashboard/admin/hiring-managers';
    if (type.includes('procurement')) return '/dashboard/admin/procurement';
    if (type.includes('finance')) return '/dashboard/admin/finance';
    if (type.includes('vendor')) return '/dashboard/admin/partner-vendors';
    if (/team|user|account/.test(type)) return '/dashboard/admin/team';
    return null;
  }
  if (role === 'Super Admin') {
    if (/candidate|offer|agreement/.test(type)) return '/dashboard/superadmin/candidate-management';
    if (type.includes('requisition')) return '/dashboard/requisitions';
    return null;
  }
  if (['Hiring Manager', 'HR'].includes(role)) {
    const requisitionId = notification.data?.requisition_id;
    if (/requisition|candidate|shortlist/.test(type) && requisitionId) return `/dashboard/requisitions/${encodeURIComponent(requisitionId)}/candidates`;
    if (type.includes('requisition')) return '/dashboard/requisitions';
    if (type.includes('timesheet')) return '/dashboard/workforce/timesheets';
    if (type.includes('expense')) return '/dashboard/workforce/expenses';
    if (type.includes('team')) return '/dashboard/workforce/team';
    if (/offer|agreement/.test(type)) return '/dashboard/candidates/accepted';
    return null;
  }
  if (type.includes('requisition')) return role === 'Director' ? '/dashboard/director/requisitions' : '/dashboard/requisitions';
  if (/candidate|offer|agreement/.test(type)) return '/dashboard/workforce/workers';
  return null;
}
