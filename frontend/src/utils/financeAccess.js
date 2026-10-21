export function isFinanceRole(role) {
  return ['finance', 'finance team'].includes(String(role || '').trim().toLowerCase());
}

export function financeRedirect(role, pathname) {
  if (!isFinanceRole(role)) return null;
  if (/^\/dashboard\/finance(?:\/(?:work-orders|approvals|profile))?\/?$/.test(pathname)) return null;
  if (pathname === '/dashboard' || pathname.startsWith('/dashboard/') || /^\/(?:interview-panel|requisitions)(?:\/|$)/.test(pathname)) return '/dashboard/finance';
  return null;
}
