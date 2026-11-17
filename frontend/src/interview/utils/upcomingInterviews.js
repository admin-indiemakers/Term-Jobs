export function upcomingInterviewRounds(rounds = [], requisitions = null, now = new Date()) {
  if (!Array.isArray(rounds)) return [];
  const hasReqFilter = Array.isArray(requisitions);
  const requisitionIds = hasReqFilter
    ? new Set(requisitions.map(row => String(row?.id || row?.requisition_id || '')))
    : null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const seen = new Set();
  return rounds.filter(round => {
    if (!round) return false;
    const id = round.id || round.round_id;
    if (!id || seen.has(id)) return false;
    if (hasReqFilter && (!round.requisition_id || !requisitionIds.has(String(round.requisition_id)))) return false;
    if (!round.candidate_submission_id && !round.candidate_id) return false;
    if (!['scheduled', 'confirmed'].includes(String(round.status || '').toLowerCase())) return false;
    if (!round.scheduled_date) return false;
    // Date-only schedules are local calendar days, not UTC midnight.
    const date = /^\d{4}-\d{2}-\d{2}$/.test(round.scheduled_date)
      ? new Date(`${round.scheduled_date}T00:00:00`)
      : new Date(round.scheduled_date);
    if (Number.isNaN(date.getTime()) || date < today) return false;
    if (/^\d{1,2}:\d{2}(?:\s*[AP]M)?$/i.test(round.scheduled_time || '')) {
      const match = round.scheduled_time.match(/^(\d{1,2}):(\d{2})(?:\s*([AP]M))?$/i);
      if (match) {
        const [, hour, minute, period] = match;
        const h = period ? Number(hour) % 12 + (period.toUpperCase() === 'PM' ? 12 : 0) : Number(hour);
        date.setHours(h, Number(minute), 0, 0);
        if (date < now) return false;
      }
    }
    seen.add(id);
    return true;
  }).sort((a, b) => String(a.scheduled_date).localeCompare(String(b.scheduled_date)));
}
