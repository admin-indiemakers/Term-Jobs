import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('normal startup does not paint the no-JavaScript fallback before React mounts', () => {
  const scriptedHtml = html.replace(/<noscript>[\s\S]*?<\/noscript>/g, '');
  assert.match(scriptedHtml, /<div id="root"><\/div>/);
  assert.doesNotMatch(scriptedHtml, /<header\b|<h1\b/);
  assert.match(html, /<noscript>\s*<header/);
});
