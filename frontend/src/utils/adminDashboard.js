export function dashboardList(payload, key) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.[key])) return payload[key];
  throw new Error(`Unexpected ${key} response. Please retry.`);
}

export function normalizeDashboardStatus(status) {
  return String(status || '').toLowerCase().replace(/[\s_-]/g, '');
}

export function isValidCompanyName(name) {
  if (!name || typeof name !== 'string') return false;
  const clean = name.trim();
  if (clean.length < 2 || clean.length > 80) return false;
  const lower = clean.toLowerCase();

  const rejectLabels = new Set(['enterprise partner', 'direct applicant', 'general', 'n/a', 'none', 'unknown', 'null', 'all']);
  if (rejectLabels.has(lower)) return false;

  // Reject test artifacts (e.g. test, testxcvgb, testing)
  if (/\btest\b/i.test(lower) || lower.startsWith('test') || lower.endsWith('test')) return false;

  // Reject keyboard mash / random consonant sequences (e.g. xcvgb, asdfg, qwerty)
  const keyboardMashes = ['asdf', 'sdfg', 'dfgh', 'fghj', 'ghjk', 'hjkl', 'qwer', 'wert', 'erty', 'rtyu', 'tyui', 'yuio', 'uiop', 'zxcv', 'xcvb', 'cvbn', 'vbnm'];
  if (keyboardMashes.some((pattern) => lower.includes(pattern))) return false;
  if (/^[bcdfghjklmnpqrstvwxyz]{4,}$/i.test(lower)) return false;

  // Must contain at least one vowel unless it's a common acronym/short word
  const hasVowelOrY = /[aeiouy]/i.test(lower);
  if (!hasVowelOrY && clean.length > 3) return false;

  // Must contain at least one letter
  if (!/[a-zA-Z]/.test(clean)) return false;

  return true;
}
