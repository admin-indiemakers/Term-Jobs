// Keep Director navigation in the executive portal, including legacy HM links.
export function directorRedirect(role, pathname) {
  if (String(role || '').trim().toLowerCase() !== 'director') return null;
  if (pathname === '/dashboard/director' || pathname.startsWith('/dashboard/director/')) return null;
  const match = pathname.match(/^\/dashboard\/requisitions\/([^/]+)$/);
  const sections = new Set(['new', 'published', 'pending-approval', 'pending', 'drafted', 'completed', 'history']);
  if (match && !sections.has(match[1])) {
    return `/dashboard/director/requisitions?reqId=${match[1]}`;
  }
  if (pathname.startsWith('/dashboard/requisitions')) return '/dashboard/director/requisitions';
  return '/dashboard/director';
}
