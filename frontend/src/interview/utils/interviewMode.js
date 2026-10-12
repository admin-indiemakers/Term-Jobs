export function isAiInterviewRound(round) {
  return /^AI\b/i.test(String(round?.round_name || '')) || String(round?.round_type || '').toLowerCase() === 'ai';
}
