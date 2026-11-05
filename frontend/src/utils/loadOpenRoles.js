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
