import assert from 'node:assert/strict';
import test from 'node:test';
import { Writable } from 'node:stream';
import { backendTarget } from '../server/backendTarget.js';
import { proxyRequest } from '../api/proxy.js';

function response() {
  const parts = [];
  const res = new Writable({ write(chunk, encoding, done) { parts.push(Buffer.from(chunk)); done(); } });
  res.headers = {};
  res.setHeader = (name, value) => { res.headers[name.toLowerCase()] = value; };
  res.text = () => Buffer.concat(parts).toString();
  return res;
}
const preview = { VERCEL_GIT_COMMIT_REF: 'qa', VERCEL_ENV: 'preview', QA_BACKEND_URL: 'https://qa-backend.example.test' };
const request = () => ({ url: '/api/proxy?__path=candidates&status=Shortlisted', method: 'GET', headers: { authorization: 'Bearer private-test', 'x-termjobs-required-cluster': 'main' } });

test('only main production deployments may use production backend', () => {
  assert.equal(backendTarget({ VERCEL_GIT_COMMIT_REF: 'main', VERCEL_ENV: 'production' }).cluster, 'main');
  for (const branch of ['dev', 'main', '', 'feature/test']) {
    assert.throws(() => backendTarget({ VERCEL_GIT_COMMIT_REF: branch, VERCEL_ENV: 'preview' }), /disabled/);
  }
});

test('QA and dev never fall back to a generic or production API URL', () => {
  for (const url of ['https://term-jobs-j8ja-seven.vercel.app', 'https://termjobs.in', 'https://www.termjobs.in', 'https://termjobs.vercel.app']) {
    assert.throws(() => backendTarget({ ...preview, QA_BACKEND_URL: url }), /production/);
  }
  assert.equal(backendTarget({ ...preview, QA_BACKEND_URL: '', VITE_API_URL: 'https://production.example' }).origin, 'https://term-jobs-j8ja-git-qa-i-ndiemakers.vercel.app');
  assert.throws(() => backendTarget({ ...preview, QA_BACKEND_URL: 'https://other-production.example', PRODUCTION_BACKEND_URL: 'https://other-production.example' }), /production/);
  assert.equal(backendTarget({ VERCEL_GIT_COMMIT_REF: 'dev', DEV_BACKEND_URL: 'https://dev.example.test' }).origin, 'https://dev.example.test');
  assert.throws(() => backendTarget({ ...preview, QA_BACKEND_URL: 'https://qa-frontend.example.test', VERCEL_BRANCH_URL: 'qa-frontend.example.test' }), /proxy loop/);
});

test('unconfigured dev deployment fails before any network request or credential transmission', async () => {
  const res = response();
  await proxyRequest(request(), res, { VERCEL_GIT_COMMIT_REF: 'dev' }, () => assert.fail('must not fetch production'));
  assert.equal(res.statusCode, 503);
  assert.match(res.text(), /isolation/);
});

test('QA uses the supplied backend alias and still verifies its cluster before forwarding', async () => {
  assert.deepEqual(backendTarget({ VERCEL_GIT_COMMIT_REF: 'qa', VERCEL_ENV: 'preview' }), {
    origin: 'https://term-jobs-j8ja-git-qa-i-ndiemakers.vercel.app', cluster: 'dev_qa',
  });
  let calls = 0;
  const res = response();
  await proxyRequest(request(), res, { VERCEL_GIT_COMMIT_REF: 'qa' }, async (url, options) => {
    calls++;
    assert.equal(String(url), 'https://term-jobs-j8ja-git-qa-i-ndiemakers.vercel.app/api/environment');
    assert.equal(options.headers, undefined);
    return Response.json({ active_cluster: 'main' });
  });
  assert.equal(calls, 1);
  assert.equal(res.statusCode, 503);
});

test('a backend alias reporting main is rejected before forwarding credentials', async () => {
  const calls = [];
  const res = response();
  await proxyRequest(request(), res, preview, async (url, options) => {
    calls.push([String(url), options]);
    return Response.json({ active_cluster: 'main' });
  });
  assert.equal(res.statusCode, 503);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], 'https://qa-backend.example.test/api/environment');
  assert.equal(calls[0][1].headers, undefined);
  assert.equal(calls[0][1].redirect, 'error');
});

test('verified QA requests retain query parameters and enforce the QA cluster', async () => {
  const calls = [];
  const res = response();
  await proxyRequest(request(), res, preview, async (url, options) => {
    calls.push([String(url), options]);
    return calls.length === 1 ? Response.json({ active_cluster: 'dev_qa' }) : Response.json({ candidates: [] });
  });
  assert.equal(res.statusCode, 200);
  assert.equal(calls[1][0], 'https://qa-backend.example.test/api/candidates?status=Shortlisted');
  assert.equal(calls[1][1].headers.get('x-termjobs-required-cluster'), 'dev_qa');
  assert.equal(calls[1][1].headers.get('authorization'), 'Bearer private-test');
  assert.deepEqual(JSON.parse(res.text()), { candidates: [] });
  assert.equal(res.headers['cache-control'], 'no-store');
});

test('QA mutations verify isolation before forwarding the selected application body', async () => {
  const calls = [];
  const req = { ...request(), method: 'POST', body: { requisition_id: 'req' }, url: '/api/proxy?__path=candidates/sub/direct-shortlist' };
  await proxyRequest(req, response(), preview, async (url, options) => {
    calls.push([String(url), options]);
    return calls.length === 1 ? Response.json({ active_cluster: 'dev_qa' }) : Response.json({ status: 'Shortlisted' });
  });
  assert.equal(calls[0][1].body, undefined);
  assert.equal(calls[1][1].body, JSON.stringify(req.body));
  assert.equal(calls[1][1].method, 'POST');
});

test('unavailable or unverifiable preview backends fail closed', async () => {
  for (const result of [new Error('offline'), new Response('not an environment response'), Response.json({ active_cluster: 'main' })]) {
    let count = 0;
    const res = response();
    await proxyRequest(request(), res, preview, async () => {
      count++;
      if (result instanceof Error) throw result;
      return result;
    });
    assert.equal(res.statusCode, 503);
    assert.equal(count, 1);
  }
});

test('main production requests retain their existing production backend', async () => {
  let calls = 0;
  const res = response();
  await proxyRequest(request(), res, { VERCEL_GIT_COMMIT_REF: 'main', VERCEL_ENV: 'production' }, async (url, options) => {
    calls++;
    assert.equal(new URL(url).origin, 'https://term-jobs-j8ja-seven.vercel.app');
    assert.equal(options.headers.get('x-termjobs-required-cluster'), 'main');
    return Response.json({ ok: true });
  });
  assert.equal(calls, 1);
  assert.equal(res.statusCode, 200);
});

test('protected QA backends use a server-only bypass while still requiring dev_qa', async () => {
  const secret = 'server-only-test-secret';
  const calls = [];
  const req = request();
  req.headers['x-vercel-protection-bypass'] = 'untrusted-client-value';
  const res = response();
  await proxyRequest(req, res, { ...preview, BACKEND_PROTECTION_BYPASS_SECRET: secret }, async (url, options) => {
    assert.ok(!String(url).includes(secret));
    calls.push(options);
    if (calls.length === 1) {
      assert.equal(options.headers['x-vercel-protection-bypass'], secret);
      assert.equal(options.headers.authorization, undefined);
      return Response.json({ active_cluster: 'dev_qa' });
    }
    assert.equal(options.headers.get('x-vercel-protection-bypass'), secret);
    assert.equal(options.headers.get('x-termjobs-required-cluster'), 'dev_qa');
    return Response.json({ ok: true }, { headers: { 'x-vercel-protection-bypass': secret } });
  });
  assert.equal(res.statusCode, 200);
  assert.equal(calls.length, 2);
  assert.ok(!JSON.stringify(res.headers).includes(secret));
  assert.ok(!res.text().includes(secret));
});
