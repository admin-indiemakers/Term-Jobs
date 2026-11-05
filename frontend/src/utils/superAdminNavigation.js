export function superAdminNavigation({ icons, selectedCount, candidateCount, onboardCompany, onboardVendor }) {
  return [
    { to: '/dashboard/superadmin', label: 'Overview', end: true, section: 'WORKSPACE', icon: icons.Dashboard },
    { to: '/dashboard/superadmin/chat', label: 'AI Assistant', end: true, section: 'WORKSPACE', icon: icons.Chat },
    { to: '/dashboard/superadmin/requisitions', label: 'Company Requisitions', section: 'HIRING', icon: icons.Requisitions },
    { to: '/dashboard/superadmin/candidates', label: 'Candidate Pool', section: 'HIRING', icon: icons.Diamond, count: candidateCount },
    { to: '/dashboard/superadmin/outreach', label: 'AI Email Outreach', section: 'HIRING', icon: icons.Mail },
    { to: '/dashboard/interviews', label: 'Interviews & AI Scores', section: 'HIRING', icon: icons.Interviews },
    { to: '/dashboard/superadmin/candidate-management', label: 'Candidate Selections', section: 'PLACEMENTS', icon: icons.Accepted, badge: selectedCount },
    { to: '/dashboard/superadmin/candidate-management?tab=billing', label: 'Billing & Work Orders', section: 'PLACEMENTS', icon: icons.Receipt },
    { to: '/dashboard/superadmin/accounts', label: 'Buyer Accounts', section: 'ACCOUNTS', icon: icons.Requisitions },
    { to: '/dashboard/superadmin/vendor-accounts', label: 'Vendor Accounts', section: 'ACCOUNTS', icon: icons.Flag },
    { to: '/dashboard/superadmin/admin-accounts', label: 'Admin Accounts', section: 'ACCOUNTS', icon: icons.PortalAccess },
    { action: onboardCompany, label: 'Onboard Company', section: 'ONBOARDING', icon: icons.Plus },
    { action: onboardVendor, label: 'Onboard Vendor', section: 'ONBOARDING', icon: icons.Plus },
  ];
}

export function isSuperAdminNavActive(item, pathname, search = '') {
  if (!item.to) return false;
  const candidateManagement = /^\/dashboard\/(?:superadmin\/)?candidate-management(?:\/|$)/.test(pathname);
  const tab = new URLSearchParams(search).get('tab');
  if (item.to.includes('candidate-management')) {
    return candidateManagement && (item.to.includes('?tab=billing') ? tab === 'billing' : tab !== 'billing');
  }
  if (item.to === '/dashboard/superadmin/candidates') {
    return /^\/dashboard\/(?:superadmin\/)?(?:candidates|candidatepool|candidate-pool|candidatespool|candidates-pool)(?:\/|$)/.test(pathname);
  }
  if (item.to === '/dashboard/superadmin/outreach') {
    return /^\/dashboard\/(?:superadmin\/)?(?:outreach|candidate-outreach)(?:\/|$)/.test(pathname);
  }
  return item.end ? pathname.replace(/\/$/, '') === item.to : pathname === item.to || pathname.startsWith(`${item.to}/`);
}
