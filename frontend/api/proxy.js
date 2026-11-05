import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { backendTarget } from '../server/backendTarget.js';

const excluded = new Set(['host', 'connection', 'content-length', 'transfer-encoding', 'keep-alive', 'upgrade', 'proxy-authorization', 'proxy-authenticate', 'te', 'trailer', 'content-encoding', 'x-vercel-protection-bypass', 'x-vercel-set-bypass-cookie']);

export async function proxyRequest(req, res, env = process.env, transport = fetch) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const target = backendTarget(env);
    const bypass = env.BACKEND_PROTECTION_BYPASS_SECRET;
    // Verify the destination before sending cookies, credentials, or request bodies.
    if (target.cluster === 'dev_qa') {
      const check = await transport(`${target.origin}/api/environment`, {
        redirect: 'error', signal: AbortSignal.timeout(10000),
        headers: bypass ? { 'x-vercel-protection-bypass': bypass } : undefined,
      });
      if (!check.ok || (await check.json()).active_cluster !== 'dev_qa') {
        throw new Error('QA/dev backend isolation could not be verified. API access is disabled.');
      }
    }
    const incoming = new URL(req.url, 'https://proxy.invalid');
    const route = incoming.searchParams.get('__path') || '';
    incoming.searchParams.delete('__path');
    const destination = new URL(`/api/${route}`, target.origin);
    if (destination.origin !== target.origin || !destination.pathname.startsWith('/api/')) throw new Error('Invalid API path.');
    destination.search = incoming.search;
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (!excluded.has(key.toLowerCase()) && value != null) headers.set(key, Array.isArray(value) ? value.join(', ') : value);
    }
    headers.set('x-termjobs-required-cluster', target.cluster);
    if (bypass) headers.set('x-vercel-protection-bypass', bypass);
    const options = { method: req.method, headers, redirect: 'manual' };
    if (!['GET', 'HEAD'].includes(req.method)) {
      // Vercel parses JSON bodies; multipart and other unparsed bodies stay streams.
      options.body = req.body == null ? req : typeof req.body === 'object' && !Buffer.isBuffer(req.body) ? JSON.stringify(req.body) : req.body;
      options.duplex = 'half';
    }
    const upstream = await transport(destination, options);
    res.statusCode = upstream.status;
    upstream.headers.forEach((value, key) => { if (!excluded.has(key.toLowerCase()) && key.toLowerCase() !== 'set-cookie') res.setHeader(key, value); });
    const cookies = upstream.headers.getSetCookie?.();
    if (cookies?.length) res.setHeader('Set-Cookie', cookies);
    res.setHeader('Cache-Control', 'no-store');
    if (upstream.body && req.method !== 'HEAD') await pipeline(Readable.fromWeb(upstream.body), res);
    else res.end();
  } catch (error) {
    if (res.headersSent) { res.destroy(error); return; }
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ detail: 'API unavailable: database isolation is not configured or could not be verified.' }));
  }
}

export default function handler(req, res) { return proxyRequest(req, res); }
