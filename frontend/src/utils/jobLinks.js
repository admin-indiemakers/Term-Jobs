export function publicJobPath(job) {
  const id = job?.id || job?._id;
  if (!id) return '/jobs';
  return `/open-roles?requisition=${encodeURIComponent(String(id))}`;
}

export function publicJobUrl(job, origin = window.location.origin) {
  return `${origin}${publicJobPath(job)}`;
}
