export function isAiInterviewRound(round) {
  return /^AI\b/i.test(String(round?.round_name || '')) || String(round?.round_type || '').toLowerCase() === 'ai';
}

export function mergeInterviewResult(round, result) {
  if (!round || !result || typeof result !== 'object') return round;
  if (result.analysis || result.metrics) {
    return { ...round,
      status: result.status === 'Completed' || result.analysis ? 'Completed' : round.status,
      ...(result.analysis ? { communication_analysis: result.analysis } : {}),
      ...(result.metrics ? { communication_metrics: result.metrics } : {}),
    };
  }
  if (result.id && result.id !== round.id) return round;
  return { ...round, ...result };
}
