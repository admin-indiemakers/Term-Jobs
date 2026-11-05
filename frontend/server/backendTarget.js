const PRODUCTION_BACKEND = 'https://term-jobs-j8ja-seven.vercel.app';
const QA_BACKEND = 'https://term-jobs-j8ja-git-qa-i-ndiemakers.vercel.app';

export function backendTarget(env = process.env) {
  const branch = (env.VERCEL_GIT_COMMIT_REF || '').toLowerCase();
  const production = branch === 'main' && env.VERCEL_ENV === 'production';
  const configured = production ? env.PRODUCTION_BACKEND_URL || PRODUCTION_BACKEND
    : (branch === 'qa' ? env.QA_BACKEND_URL || env.DEV_QA_BACKEND_URL || QA_BACKEND : branch === 'dev' ? env.DEV_BACKEND_URL || env.DEV_QA_BACKEND_URL : env.DEV_QA_BACKEND_URL);
  if (!configured) throw new Error('QA/dev API is disabled until QA_BACKEND_URL, DEV_BACKEND_URL, or DEV_QA_BACKEND_URL is configured.');
  const target = new URL(configured);
  if (target.protocol !== 'https:' || target.username || target.password || !['', '/', '/api', '/api/'].includes(target.pathname) || target.search || target.hash) {
    throw new Error('Backend URL must be an HTTPS origin.');
  }
  const productionHosts = [PRODUCTION_BACKEND, env.PRODUCTION_BACKEND_URL, 'https://termjobs.in', 'https://www.termjobs.in', 'https://termjobs.vercel.app']
    .filter(Boolean).map(value => new URL(value).hostname);
  if (!production && productionHosts.includes(target.hostname)) throw new Error('QA/dev cannot proxy to a production backend.');
  const frontendHosts = [env.VERCEL_URL, env.VERCEL_BRANCH_URL].filter(Boolean)
    .map(value => new URL(value.includes('://') ? value : `https://${value}`).hostname);
  if (frontendHosts.includes(target.hostname)) throw new Error('Backend URL points to this frontend and would create a proxy loop.');
  return { origin: target.origin, cluster: production ? 'main' : 'dev_qa' };
}
