export function isAuditableAssessment(analysis) {
  if (analysis?.status !== 'scored' || !analysis.rubric_version || !Number.isFinite(analysis.overall_score)) return false;
  const rows = analysis.competencies;
  if (!Array.isArray(rows) || !rows.length) return false;
  if (rows.some(row => !Number.isInteger(row.rating) || row.rating < 1 || row.rating > 5 || !Number.isFinite(row.weight) || row.weight <= 0 || !analysis.competency_dictionary?.[row.competency])) return false;
  const weight = rows.reduce((sum, row) => sum + row.weight, 0);
  const score = Math.round(rows.reduce((sum, row) => sum + (row.rating - 1) / 4 * row.weight * 100, 0));
  return Math.abs(weight - 1) < 0.00001 && score === analysis.overall_score;
}

export function assertReviewRound(roundId, report) {
  if (report?.round_id !== roundId) throw new Error('The review response does not match this interview round.');
  return report;
}
