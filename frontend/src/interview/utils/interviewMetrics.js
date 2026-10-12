export function interviewMetrics(rounds, requisitions) {
  const requisitionIds = new Set(requisitions.map(row => String(row.id)));
  const seen = new Set();
  const actualRounds = rounds.filter(round => {
    const id = round.id || round.round_id;
    if (!id || seen.has(id) || !requisitionIds.has(String(round.requisition_id))) return false;
    if (!round.candidate_submission_id && !round.candidate_id) return false;
    const status = String(round.status || '').toLowerCase().replace(/[\s_-]/g, '');
    if (!['scheduled', 'confirmed', 'inprogress', 'completed'].includes(status)) return false;
    if (!round.scheduled_date || Number.isNaN(new Date(round.scheduled_date).getTime())) return false;
    seen.add(id);
    return true;
  });
  const scoredRounds = actualRounds.filter(round => {
    const analysis = round.communication_analysis;
    return analysis && typeof analysis === 'object' && !Array.isArray(analysis)
      && Number.isFinite(analysis.overall_score);
  });
  return { interviewCount: actualRounds.length, aiScoreCount: scoredRounds.length };
}
