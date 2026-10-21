const lockedStatuses = new Set(['SUBMITTED', 'APPROVED', 'INVOICED', 'PAID']);
export function eligiblePatternDay(entry, { today, assignmentStart, locked = false }) {
  if (locked || !entry?.date || entry.date > today || (assignmentStart && entry.date < assignmentStart)) return false;
  const weekday = new Date(`${entry.date}T12:00:00Z`).getUTCDay();
  if (!Number.isFinite(weekday) || weekday === 0 || weekday === 6) return false;
  if (entry.locked || entry.is_locked || entry.read_only || lockedStatuses.has(String(entry.status || '').toUpperCase())) return false;
  return ['Regular', 'Overtime', undefined, null, ''].includes(entry.category);
}

export function applyWorkdayPattern(entries, sourceIndex, options) {
  const source = entries[sourceIndex];
  const hours = Number(source?.hours);
  if (!eligiblePatternDay(source, options) || !Number.isFinite(hours) || hours < 0 || hours > 24) return { entries, changed: 0 };
  let changed = 0;
  const updated = entries.map((entry, index) => {
    if (index === sourceIndex || !eligiblePatternDay(entry, options)) return entry;
    const category = source.category || 'Regular';
    if (Number(entry.hours) === hours && (entry.category || 'Regular') === category) return entry;
    changed++;
    return { ...entry, hours, category };
  });
  return { entries: updated, changed };
}
