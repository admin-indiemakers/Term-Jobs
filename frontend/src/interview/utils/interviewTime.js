// Native time inputs require HH:MM, even when older proposals contain AM/PM.
export function interviewTime(value = '') {
  const text = String(value).trim();
  const clock = text.match(/^(0?[1-9]|1[0-2])(?::([0-5]\d))?\s*(am|pm)(?:\s+\S+)?$/i);
  if (clock) {
    const hour = Number(clock[1]) % 12 + (clock[3].toLowerCase() === 'pm' ? 12 : 0);
    return `${String(hour).padStart(2, '0')}:${clock[2] || '00'}`;
  }
  return /^(?:[01]?\d|2[0-3]):[0-5]\d$/.test(text) ? text.padStart(5, '0') : '';
}
