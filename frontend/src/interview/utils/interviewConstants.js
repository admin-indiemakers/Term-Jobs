export const ROUND_TYPES = [
  { id: 'Recruiter', label: 'Recruiter Screening', defaultDuration: 30, icon: 'UserCheck', description: 'Initial qualification, resume walkthrough, salary expectation and timeline alignment.' },
  { id: 'Technical_1', label: 'Technical Round 1', defaultDuration: 45, icon: 'Code', description: 'Core programming language, problem solving, data structures, and live coding.' },
  { id: 'Technical_2', label: 'Technical Round 2', defaultDuration: 60, icon: 'Cpu', description: 'System design, architecture, framework deep-dive, and hands-on scenarios.' },
  { id: 'Manager', label: 'Managerial Round', defaultDuration: 45, icon: 'Briefcase', description: 'Leadership experience, team dynamics, situational judgment, and delivery management.' },
  { id: 'Final', label: 'Executive / Final Round', defaultDuration: 30, icon: 'Award', description: 'Director or CTO conversation, culture fit, offer alignment, and final approval.' },
  { id: 'Custom', label: 'Custom Interview Round', defaultDuration: 45, icon: 'Layers', description: 'Custom tailored round according to requisition specifics.' },
];

export const ROUND_STATUS = {
  SCHEDULED: 'Scheduled',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  NO_SHOW: 'No Show',
};

export const EVALUATION_VERDICTS = [
  { value: 'Strong Yes', label: 'Strong Yes', color: 'bg-emerald-600 text-white border-emerald-600', badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200', hint: 'Exceeded all technical and behavioral expectations. High priority hire.' },
  { value: 'Yes', label: 'Yes', color: 'bg-teal-600 text-white border-teal-600', badgeClass: 'bg-teal-50 text-teal-700 border-teal-200', hint: 'Solid performance. Meets all core job criteria and recommended to proceed.' },
  { value: 'Maybe', label: 'Maybe / Borderline', color: 'bg-amber-500 text-white border-amber-500', badgeClass: 'bg-amber-50 text-amber-700 border-amber-200', hint: 'Mixed signals or borderline performance. Suggests a follow-up check or tie-breaker.' },
  { value: 'No', label: 'No', color: 'bg-rose-600 text-white border-rose-600', badgeClass: 'bg-rose-50 text-rose-700 border-rose-200', hint: 'Did not meet requirements or competencies expected for this position.' },
  { value: 'No Show', label: 'No Show', color: 'bg-zinc-600 text-white border-zinc-600', badgeClass: 'bg-zinc-100 text-zinc-700 border-zinc-200', hint: 'Candidate or interviewer did not appear for scheduled meeting.' },
];

export const EVAL_CRITERIA = [
  { key: 'technical', label: 'Technical & Domain Competency', hint: 'Hands-on ability, system comprehension, correctness' },
  { key: 'communication', label: 'Communication & Clarity', hint: 'Ability to explain thought process, listen, articulate solutions' },
  { key: 'problem_solving', label: 'Problem Solving & Logic', hint: 'Analytical thinking, handling ambiguities, edge cases' },
  { key: 'culture', label: 'Culture & Collaboration', hint: 'Team fit, ownership mindset, curiosity, professionalism' },
];
