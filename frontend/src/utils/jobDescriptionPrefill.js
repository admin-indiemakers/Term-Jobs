import { deadlineError, todayForDeadline } from './submissionDeadline.js';

const scalarFields = [
  'company_name', 'job_title', 'department', 'industry', 'location', 'min_experience',
  'max_experience', 'salary', 'employment_type', 'contract_period', 'work_mode', 'openings',
  'target_start_date', 'application_deadline', 'working_hours', 'role_overview',
];
const listFields = [
  'required_skills', 'preferred_skills', 'responsibilities', 'technical_skills',
  'soft_skills', 'qualifications', 'benefits', 'verification_warnings',
];

export function validateParsedJob(data) {
  if (!data || scalarFields.some(key => typeof data[key] !== 'string')
    || listFields.some(key => !Array.isArray(data[key]) || data[key].some(item => typeof item !== 'string'))) {
    throw new Error('The parser returned an invalid result. Try again before filling the form.');
  }
  return data;
}

function formatDate(value) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const named = /^(?:([a-z]+) (\d{1,2}),?|(?:(\d{1,2}) ([a-z]+))) (\d{4})$/i.exec(value);
  if (!named) return '';
  const [, monthFirst, daySecond, dayFirst, monthSecond, year] = named;
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const name = (monthFirst || monthSecond).toLowerCase();
  const month = months.findIndex(item => item.toLowerCase() === name || item.slice(0, 3).toLowerCase() === name) + 1;
  if (!month) return '';
  return `${year}-${String(month).padStart(2, '0')}-${(daySecond || dayFirst).padStart(2, '0')}`;
}

function describeJob(job) {
  const lines = [];
  const item = (label, value) => { if (value) lines.push(`${label}: ${value}`); };
  const block = (title, entries) => {
    if (entries.length) lines.push(`${title}:\n${entries.map(entry => `- ${entry}`).join('\n')}`);
  };
  item('Position', job.job_title);
  item('Company', job.company_name);
  item('Role Overview', job.role_overview);
  block('Roles and Responsibilities', job.responsibilities);
  const soft = new Set(job.soft_skills.map(skill => skill.toLowerCase()));
  const technical = new Set(job.technical_skills.map(skill => skill.toLowerCase()));
  block('Required Technical Skills', job.required_skills.filter(skill => technical.has(skill.toLowerCase()) && !soft.has(skill.toLowerCase())));
  block('Other Required Skills', job.required_skills.filter(skill => !technical.has(skill.toLowerCase()) && !soft.has(skill.toLowerCase())));
  block('Preferred Skills', job.preferred_skills);
  block('Soft Skills', job.soft_skills);
  block('Eligibility', [...job.qualifications, job.min_experience && `Minimum experience: ${job.min_experience}`, job.max_experience && `Maximum experience: ${job.max_experience}`].filter(Boolean));
  block('Work Details', [
    ['Employment type', job.employment_type], ['Location', job.location], ['Work mode', job.work_mode],
    ['Working hours', job.working_hours], ['Contract period', job.contract_period], ['Salary', job.salary],
  ].filter(([, value]) => value).map(([label, value]) => `${label}: ${value}`));
  block('Benefits', job.benefits);
  return lines.join('\n\n');
}

export function buildJobPrefill(data, today = todayForDeadline()) {
  const job = validateParsedJob(data);
  const warnings = [...job.verification_warnings];
  const modes = new Map([['onsite', 'On-site'], ['hybrid', 'Hybrid'], ['remote', 'Remote'], ['workfromhome', 'Remote'], ['wfh', 'Remote']]);
  const workMode = modes.get(job.work_mode.toLowerCase().replace(/[\s-]/g, ''));
  if (job.work_mode && !workMode) warnings.push('Work mode needs manual selection.');
  const deadline = formatDate(job.application_deadline);
  const validDeadline = deadline && !deadlineError(deadline, today);
  if (job.application_deadline && !validDeadline) warnings.push('Application deadline needs a valid date of today or later.');
  const start = formatDate(job.target_start_date);
  const validStart = start && !deadlineError(start, today);
  const currentMonth = /^(\d{4})-(0[1-9]|1[0-2])$/.test(job.target_start_date) && job.target_start_date >= today.slice(0, 7);
  const namedMonth = /^(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?) \d{4}$/i.test(job.target_start_date);
  const monthStart = namedMonth && formatDate(job.target_start_date.replace(/ (\d{4})$/, ' 1 $1'));
  const validNamedMonth = monthStart && monthStart.slice(0, 7) >= today.slice(0, 7);
  if (job.target_start_date && !validStart && !currentMonth && !validNamedMonth) warnings.push('Target start date needs manual verification.');
  const openings = /^(?:\d+|\d{1,3}(?:,\d{3})+)$/.test(job.openings) ? Number(job.openings.replaceAll(',', '')) : 0;
  if (job.openings && (openings < 1 || openings > 10000)) warnings.push('Number of openings needs a single value from 1 to 10,000.');
  const experience = job.min_experience && job.max_experience
    ? job.min_experience === job.max_experience ? job.min_experience : `${job.min_experience} – ${job.max_experience}`
    : job.min_experience || (job.max_experience ? `Up to ${job.max_experience}` : '');
  const description = describeJob(job);
  const values = {
    company_name: job.company_name, title: job.job_title, department: job.department,
    industry: job.industry, location: job.location, experience, salary: job.salary,
    employment_type: job.employment_type, duration: job.contract_period, work_mode: workMode,
    headcount: openings >= 1 && openings <= 10000 ? String(openings) : '',
    start_date: validStart ? start : currentMonth || validNamedMonth ? job.target_start_date : '',
    submission_deadline: validDeadline ? deadline : '', working_hours: job.working_hours,
    skills: job.required_skills.join(', '), preferred_skills: job.preferred_skills.join(', '),
    job_description: description,
  };
  return { job, values: Object.fromEntries(Object.entries(values).filter(([, value]) => value)), description, warnings };
}
