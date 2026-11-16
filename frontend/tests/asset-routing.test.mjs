import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const { routes } = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
function resolve(path, files = new Set()) {
  const headers = {};
  for (const route of routes) {
    if (route.handle === 'filesystem') {
      if (files.has(path)) return { dest: path, headers };
      continue;
    }
    const match = new RegExp(`^${route.src}$`).exec(path);
    if (!match) continue;
    Object.assign(headers, route.headers);
    if (!route.continue) return { status: route.status, dest: route.dest?.replace('$1', match[1]), headers };
  }
}

test('missing dashboard chunks return 404 rather than the application HTML', () => {
  const response = resolve('/assets/SuperAdminDashboard-old.js');
  assert.equal(response.status, 404);
  assert.equal(response.dest, undefined);
  assert.equal(response.headers['Cache-Control'], 'no-store');
});

test('existing chunks are served from disk and dashboard HTML is revalidated', () => {
  const asset = '/assets/SuperAdminDashboard-current.js';
  assert.equal(resolve(asset, new Set([asset])).dest, asset);
  const page = resolve('/dashboard/super-admin');
  assert.equal(page.dest, '/index.html');
  assert.equal(page.headers['Cache-Control'], 'no-cache');
  assert.equal(resolve('/index.html', new Set(['/index.html'])).headers['Cache-Control'], 'no-cache');
});

test('API requests use the environment-verifying server proxy', () => {
  assert.equal(resolve('/api/auth/me').dest, '/api/proxy?__path=auth/me');
});

test('static assets override wildcard CORS without overriding API CORS', () => {
  const asset = '/assets/rolldown-runtime-BYOrzxDO.js';
  for (const files of [new Set([asset]), new Set()]) {
    assert.equal(resolve(asset, files).headers['Access-Control-Allow-Origin'], 'https://www.termjobs.in');
  }
  assert.equal(resolve('/api/auth/me').headers['Access-Control-Allow-Origin'], undefined);
});

test('HSTS covers HTML, static assets, missing assets, and proxied APIs', () => {
  const asset = '/assets/current.js';
  const files = new Set([asset, '/index.html', '/favicon.svg']);
  for (const path of ['/', '/open-roles', '/index.html', asset, '/assets/missing.js', '/favicon.svg', '/api/auth/me']) {
    assert.equal(resolve(path, files).headers['Strict-Transport-Security'], 'max-age=31536000');
  }
});

test('both API deployment roots configure HSTS for every path', () => {
  for (const path of ['../../vercel.json', '../../backend/vercel.json']) {
    const config = JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
    const rule = config.headers.find(rule => rule.source === '/(.*)');
    assert.equal(rule.headers.find(header => header.key === 'Strict-Transport-Security').value, 'max-age=31536000');
  }
});
