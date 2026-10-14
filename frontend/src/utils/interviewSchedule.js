export function toInterviewTime(value) {
  if (/^\d{2}:\d{2}$/.test(value || '')) return value;
  const match = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(value || '');
  if (!match || Number(match[1]) < 1 || Number(match[1]) > 12 || Number(match[2]) > 59) {
    throw new Error('Choose a valid interview time.');
  }
  const hours = Number(match[1]) % 12 + (match[3].toUpperCase() === 'PM' ? 12 : 0);
  return `${String(hours).padStart(2, '0')}:${match[2]}`;
}
