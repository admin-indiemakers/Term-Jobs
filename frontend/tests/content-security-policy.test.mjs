import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const { routes } = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
const policy = routes[0].headers['Content-Security-Policy'];
const directives = new Map(policy.split('; ').map(value => {
  const [name, ...sources] = value.split(' ');
  return [name, sources];
}));

test('CSP runs before filesystem, API, SPA, and missing-asset routes', () => {
  assert.equal(routes[0].continue, true);
  for (const path of ['/', '/index.html', '/open-roles', '/api/auth/me', '/assets/missing.js']) {
    assert.match(path, new RegExp(`^${routes[0].src}$`));
  }
  assert.deepEqual(directives.get('default-src'), ["'self'"]);
  assert.deepEqual(directives.get('object-src'), ["'none'"]);
  assert.deepEqual(directives.get('frame-ancestors'), ["'self'"]);
  assert.deepEqual(directives.get('script-src-attr'), ["'none'"]);
  for (const unsafe of ["'unsafe-inline'", "'unsafe-eval'", '*', 'https:']) {
    assert.ok(!directives.get('script-src').includes(unsafe));
  }
});

test('HTML scripts remain compatible without permitting arbitrary inline code', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.doesNotMatch(html, /\son\w+\s*=/i);
  for (const [, attrs, body] of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
    if (/\bsrc=/.test(attrs)) continue;
    const hash = createHash('sha256').update(body).digest('base64');
    assert.ok(directives.get('script-src').includes(`'sha256-${hash}'`), 'Update the CSP hash when inline structured data changes');
  }
  assert.match(html, /<script src="\/startup.js"><\/script>/);
  const startup = readFileSync(new URL('../public/startup.js', import.meta.url), 'utf8');
  assert.match(startup, /__PREFETCHED_REQUISITIONS__/);
  assert.match(startup, /data-deferred-fonts/);
});
