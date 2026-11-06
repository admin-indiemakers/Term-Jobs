// Accept only data fetched by this page's current API route. Old session rows
// may have come from a different backend before database isolation was fixed.
export async function loadOpenRoles(request, prefetched) {
  if (prefetched) {
    try {
      const rows = await prefetched;
      if (Array.isArray(rows)) return rows;
    } catch { /* Retry against the current API route below. */ }
  }
  const rows = await request('/api/public/requisitions', { forceRefresh: true, noCache: true });
  if (!Array.isArray(rows)) throw new Error('The open roles API returned an invalid response.');
  return rows;
}

export function openRolesPagePath({ page = 1, pageSize = 8, q = '', workMode = 'ALL', family = 'ALL', location = 'ALL', category = 'ALL' } = {}) {
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
