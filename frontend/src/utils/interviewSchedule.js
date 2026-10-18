export function toInterviewTime(value) {
  if (/^\d{2}:\d{2}$/.test(value || '')) return value;
  const match = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(value || '');
  if (!match || Number(match[1]) < 1 || Number(match[1]) > 12 || Number(match[2]) > 59) {
    throw new Error('Choose a valid interview time.');
  }
  const hours = Number(match[1]) % 12 + (match[3].toUpperCase() === 'PM' ? 12 : 0);
  return `${String(hours).padStart(2, '0')}:${match[2]}`;
}

export function format12to24(timeStr) {
  if (!timeStr) return '';
  try {
    return toInterviewTime(timeStr);
  } catch {
    return '';
  }
}

export function parseSlotToMinutes(slotStr) {
  if (!slotStr) return null;
  const match12 = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(slotStr.trim());
  if (match12) {
    let hours = parseInt(match12[1], 10) % 12;
    if (match12[3].toUpperCase() === 'PM') hours += 12;
    const minutes = parseInt(match12[2], 10);
    return hours * 60 + minutes;
  }
  const match24 = /^(\d{1,2}):(\d{2})$/.exec(slotStr.trim());
  if (match24) {
    const hours = parseInt(match24[1], 10);
    const minutes = parseInt(match24[2], 10);
    return hours * 60 + minutes;
  }
  return null;
}

export function getNowInKolkata(refDate = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(refDate);
  const get = (type) => parts.find((p) => p.type === type)?.value;
  const todayStr = `${get('year')}-${get('month')}-${get('day')}`;
  const currentHour = parseInt(get('hour'), 10) || 0;
  const currentMinute = parseInt(get('minute'), 10) || 0;
  const currentMinutes = currentHour * 60 + currentMinute;
  const minTime24 = `${String(currentHour).padStart(2, '0')}:${String(Math.min(59, currentMinute + 1)).padStart(2, '0')}`;
  const ampm = currentHour >= 12 ? 'PM' : 'AM';
  const displayHour = currentHour % 12 || 12;
  const currentTimeDisplay = `${String(displayHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')} ${ampm}`;
  return { todayStr, currentMinutes, minTime24, currentTimeDisplay };
}

export function isTimeInPast(timeStr, dateStr, refDate = new Date()) {
  if (!dateStr || !timeStr) return false;
  const { todayStr, currentMinutes } = getNowInKolkata(refDate);
  if (dateStr < todayStr) return true;
  if (dateStr > todayStr) return false;
  const slotMinutes = parseSlotToMinutes(timeStr);
  if (slotMinutes === null) return false;
  return slotMinutes <= currentMinutes;
}

export function isRoundEnded(round, refDate = new Date()) {
  if (!round) return false;
  const statusLower = String(round.status || '').toLowerCase().trim();
  if (statusLower === 'completed' || statusLower === 'ended') return true;

  const wasAlreadyScheduled = Boolean(round.isAlreadyScheduled || round.persistedRoundId);
  if (!wasAlreadyScheduled) return false;

  const hasDateAndTime = Boolean(round.scheduledDate && round.scheduledTime);
  if (!hasDateAndTime) return false;

  if (!isTimeInPast(round.scheduledTime, round.scheduledDate, refDate)) {
    return false;
  }

  // If user changed the date or time, they are intentionally rescheduling it
  const dateChanged = round.originalDate ? round.scheduledDate !== round.originalDate : false;
  const timeChanged = round.originalTime
    ? format12to24(round.scheduledTime) !== format12to24(round.originalTime)
    : false;

  return !dateChanged && !timeChanged;
}
