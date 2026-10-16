/**
 * Utility functions for parsing and formatting application due dates & deadlines.
 */

export function formatDueDate(val) {
  if (!val) return null;
  let d;
  if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val.trim())) {
    // A date-only deadline (YYYY-MM-DD) remains open through the end of that day (23:59:59.999)
    const [y, m, day] = val.trim().split('-').map(Number);
    d = new Date(y, m - 1, day, 23, 59, 59, 999);
  } else {
    d = new Date(val);
  }
  if (isNaN(d.getTime())) return null;

  const formatted = d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const diffMs = d.getTime() - Date.now();
  if (diffMs <= 0) {
    return {
      text: formatted,
      daysLeft: 'Closed',
      isExpired: true,
      isUrgent: true,
    };
  }

  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  let daysLeft = '';
  if (diffDays === 0) {
    daysLeft = diffHours <= 1 ? 'Ends in <1h' : `Ends in ${diffHours}h`;
  } else if (diffDays === 1) {
    daysLeft = 'Ends tomorrow';
  } else {
    daysLeft = `${diffDays} days left`;
  }

  return {
    text: formatted,
    daysLeft,
    isExpired: false,
    isUrgent: diffDays <= 3,
  };
}
