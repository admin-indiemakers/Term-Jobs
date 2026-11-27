// Fast persistent cache key for instant display
const CACHE_KEY = 'tj_cached_open_roles';
let memoryCachedRoles = null;

// Accept only data fetched by this page's current API route.
export async function loadOpenRoles(request, prefetched) {
  if (prefetched) {
    try {
      const rows = await prefetched;
      if (Array.isArray(rows) && rows.length > 0) {
        memoryCachedRoles = rows;
        try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(rows)); } catch (_) {}
        return rows;
      }
    } catch { /* Retry against the current API route below. */ }
  }

  // 1. Return in-memory cached roles immediately for 0ms transitions
  if (Array.isArray(memoryCachedRoles) && memoryCachedRoles.length > 0) {
    request('/api/public/requisitions').then((fresh) => {
      if (Array.isArray(fresh) && fresh.length > 0) {
        memoryCachedRoles = fresh;
        try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(fresh)); } catch (_) {}
      }
    }).catch(() => {});
    return memoryCachedRoles;
  }

  // 2. Return sessionStorage cached roles immediately for fast cold-page loads
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        memoryCachedRoles = parsed;
        request('/api/public/requisitions').then((fresh) => {
          if (Array.isArray(fresh) && fresh.length > 0) {
            memoryCachedRoles = fresh;
            try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(fresh)); } catch (_) {}
          }
        }).catch(() => {});
        return parsed;
      }
    }
  } catch (_) {}

  // 3. Fallback to network request
  const rows = await request('/api/public/requisitions');
  if (!Array.isArray(rows)) throw new Error('The open roles API returned an invalid response.');
  memoryCachedRoles = rows;
  try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(rows)); } catch (_) {}
  return rows;
}

export const OPEN_ROLES_PAGE_SIZE = 16;

export function openRolesPagePath({ page = 1, pageSize = OPEN_ROLES_PAGE_SIZE, q = '', workMode = 'ALL', family = 'ALL', location = 'ALL', category = 'ALL' } = {}) {
  const query = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
  for (const [key, value] of Object.entries({ q: q.trim(), work_mode: workMode, family, location, category })) {
    if (value && value !== 'ALL') query.set(key, value);
  }
  return `/api/public/requisitions/page?${query}`;
}

export async function loadOpenRolesPage(request, params, prefetched) {
  const path = openRolesPagePath(params);
  let result;
  if (prefetched && path === openRolesPagePath()) {
    try { result = await prefetched; } catch { /* Retry only the current backend. */ }
  }
  if (!result || !Array.isArray(result.items)) result = await request(path, { forceRefresh: true, noCache: true });
  if (!Array.isArray(result?.items) || !Number.isInteger(result.total) || !Number.isInteger(result.total_pages)) {
    throw new Error('The open roles API returned an invalid page response.');
  }
  return result;
}

export function mapLiveOpenRoles(rows) {
  return rows.flatMap(row => {
    if (!/^[a-z0-9-]+$/.test(row.id || '')) return [];
    const role = row.structured_role || {};
    const title = row.title?.trim() || role.title?.trim();
    const company = row.company_name?.trim() || 'Hiring Partner';
    if (!title || (title.toLowerCase() === 'open role' && company.toLowerCase() === 'partner enterprise')) return [];
    const location = role.location || row.company_location;
    const mode = role.work_mode || row.work_mode || '';
    return [{
      slug: row.id,
      title,
      company,
      mode: mode.toLowerCase().replace(/[- ]/g, '') === 'onsite' ? 'On-site' : mode,
      loc: Array.isArray(location) ? location.join(', ') : location || 'India',
      exp: role.experience || role.seniority_level || '',
      skills: Array.isArray(role.must_have_skills) ? role.must_have_skills : [],
      logo: row.company_logo_url,
      description: role.job_description || row.generated_jd_markdown || '',
    }];
  });
}
