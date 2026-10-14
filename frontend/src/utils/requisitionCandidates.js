export function mapRequisitionCandidates(candidates = [], rounds = []) {
  return candidates.map(c => {
    const active = rounds.some(r => ['Scheduled', 'Confirmed', 'In Progress'].includes(r.status) && String(r.candidate_submission_id) === String(c.id || c.submission_id));
    const status = c.status === 'Shortlisted' ? 'AI Shortlisted' : c.status === 'Rejected' ? 'Not Shortlisted' : c.status || 'Submitted';
    return {
      ...c, id: String(c.id || c.submission_id), submission_id: c.submission_id || c.id,
      name: c.candidate_name || 'Unnamed candidate', email: c.candidate_email || '',
      phone: c.candidate_phone || 'Not provided', avatar: c.avatar_url || null,
      initials: (c.candidate_name || '?').split(' ').map(n => n[0]).join('').slice(0, 2),
      location: c.location || 'Not provided', score: typeof c.match_score === 'number' ? Math.round(c.match_score) : null,
      allSkills: Array.isArray(c.skills) ? c.skills : c.matched_skills || [],
      skillsMatchPct: (c.matched_skills?.length || 0) + (c.missing_skills?.length || 0) ? Math.round(100 * (c.matched_skills?.length || 0) / ((c.matched_skills?.length || 0) + (c.missing_skills?.length || 0))) : null,
      skills: (Array.isArray(c.matched_skills) && c.matched_skills.length ? c.matched_skills : Array.isArray(c.skills) ? c.skills : []).slice(0, 3).concat((c.matched_skills?.length || c.skills?.length || 0) > 3 ? [`+${(c.matched_skills?.length || c.skills?.length) - 3}`] : []),
      experience: c.experience_years != null ? `${c.experience_years} yrs` : typeof c.experience === 'number' ? `${c.experience} yrs` : typeof c.experience === 'string' ? c.experience : 'Not provided',
      availability: c.availability || 'Not provided', status: active && !['Accepted', 'Hired', 'Offered', 'Rejected'].includes(c.status) ? 'In Interview' : status,
      matchRating: c.recommendation || 'Not assessed', matchSummary: c.summary || 'No saved assessment is available.',
      scoreBreakdown: c.breakdown || {}, strengths: c.strengths || [], concerns: c.missing_skills || [], isRealApi: true,
    };
  });
}
