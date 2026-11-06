const fs = require('fs');
const routes = JSON.parse(fs.readFileSync('D:/projects/Term-Jobs/audit/frontend_routes_inventory.json', 'utf8'));

const categories = {
  public: [],
  legal_seo: [],
  candidate: [],
  interview: [],
  hiring_manager: [],
  recruiter: [],
  director: [],
  finance_procurement: [],
  admin: [],
  superadmin: [],
  workforce: [],
  other: []
};

routes.forEach(r => {
  const p = r.path || '';
  if (['/', '/find-jobs', '/open-roles', '/openroles', '/jobs', '/careers', '/apply', '/jobs/contract', '/jobs/temporary', '/jobs/remote-contract', '/jobs/:slugOrId', '/job/:slugOrId', '/employers', '/solutions/contract-staffing'].includes(p)) {
    categories.public.push(p);
  } else if (p.startsWith('/privacy') || p.startsWith('/terms') || p.startsWith('/platform-rules') || p.startsWith('/resources') || p.startsWith('/career-guide')) {
    categories.legal_seo.push(p);
  } else if (p.startsWith('/candidate') || p.includes('candidate')) {
    categories.candidate.push(p);
  } else if (p.startsWith('/interview') || p.includes('interview')) {
    categories.interview.push(p);
  } else if (p.includes('hiring-manager') || p.includes('join/hiring-manager')) {
    categories.hiring_manager.push(p);
  } else if (p.includes('recruiter')) {
    categories.recruiter.push(p);
  } else if (p.includes('director') || p.includes('join/director')) {
    categories.director.push(p);
  } else if (p.includes('finance') || p.includes('procurement') || p.includes('billing')) {
    categories.finance_procurement.push(p);
  } else if (p.includes('superadmin')) {
    categories.superadmin.push(p);
  } else if (p.includes('admin')) {
    categories.admin.push(p);
  } else if (p.includes('workforce') || p.includes('workers') || p.includes('timesheet') || p.includes('expense')) {
    categories.workforce.push(p);
  } else {
    categories.other.push(p);
  }
});

for (const [k, v] of Object.entries(categories)) {
  console.log(`${k} (${v.length}):`, v.slice(0, 5), v.length > 5 ? `... +${v.length - 5} more` : '');
}

