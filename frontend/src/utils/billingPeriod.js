export function currentBillingMonth(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function billingCycle(month, now = new Date()) {
  const [year, monthNumber] = month.split('-').map(Number);
  const start = new Date(year, monthNumber - 1, 1);
  const end = new Date(year, monthNumber, 0);
  const format = (value, options) => value.toLocaleDateString('en-GB', options);
  const day = { day: '2-digit', month: 'short' };
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return {
    label: format(start, { month: 'long', year: 'numeric' }),
    range: `${format(start, day)} - ${format(end, day)}`,
    endLabel: format(end, { ...day, year: 'numeric' }),
    daysRemaining: Math.max(0, Math.round((Date.UTC(year, monthNumber, 0) - today) / 86400000)),
  };
}
