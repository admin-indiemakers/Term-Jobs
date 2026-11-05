let memoryVisitorId;

// Browser sessions count once per role; identities only come from a verified JWT.
export function roleVisitorId(storage) {
  try {
    const existing = storage.getItem('tj_role_visitor');
    if (/^[a-zA-Z0-9-]{1,100}$/.test(existing || '')) return existing;
    const id = crypto.randomUUID();
    storage.setItem('tj_role_visitor', id);
    return id;
  } catch {
    memoryVisitorId ||= crypto.randomUUID();
    return memoryVisitorId;
  }
}

export async function trackRoleView(apiBase, requisitionId, token) {
  let storage;
  try { storage = window.sessionStorage; } catch { /* Private browser mode. */ }
  const response = await fetch(`${apiBase}/api/public/requisitions/${encodeURIComponent(requisitionId)}/views`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ visitor_id: roleVisitorId(storage) }),
  });
  if (!response.ok) throw new Error('Role view could not be recorded.');
}
