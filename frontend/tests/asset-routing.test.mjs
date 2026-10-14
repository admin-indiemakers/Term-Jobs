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

test('API requests retain the backend proxy', () => {
  assert.equal(resolve('/api/auth/me').dest, 'https://term-jobs-j8ja-seven.vercel.app/api/auth/me');
});
