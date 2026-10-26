import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function script(throws = false) {
  const written = [];
  let released = false;
  const range = {
    setNumberFormat(format) { assert.equal(format, '@'); return this; },
    setRichTextValues(rows) { if (throws) throw new Error('Write failed'); written.push(...rows); },
  };
  const sheet = { getLastRow: () => 2, getMaxRows: () => 100,
    getRange(row, col, height, width) { assert.equal(row, 3); assert.equal(col, 1); assert.equal(height, 1); return range; } };
  const context = vm.createContext({
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() { released = true; } }) },
    SpreadsheetApp: {
      getActiveSpreadsheet: () => ({ getActiveSheet: () => sheet }), flush() {},
      newRichTextValue() { let value; return { setText(text) { value = text; return this; }, build() { return value; } }; },
    },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput(text) { return { text, setMimeType() { return this; } }; } },
  });
  vm.runInContext(readFileSync(new URL('../Code.gs', import.meta.url), 'utf8'), context);
  return { context, sheet, written, released: () => released };
}

test('waitlist writes literal phone, leading zeroes and formula-like requirements in eight columns', () => {
  const app = script();
  const response = app.context.doPost({ postData: { contents: JSON.stringify({
    timestamp: '2026-10-23', formType: 'Waitlist', name: 'Test', email: 'test@example.com',
    company_name: '00123', phone_number: '+91 98765 43210', requirements: '=1+1', referral_source: 'LinkedIn',
  }) } });
  assert.equal(JSON.parse(response.text).status, 'success');
  assert.deepEqual(Array.from(app.written[0]), ['2026-10-23', 'Waitlist', 'Test', 'test@example.com', '00123', '+91 98765 43210', '=1+1', 'LinkedIn']);
  assert.equal(app.released(), true);
});

test('failed sheet writes release the lock and return an error', () => {
  const app = script(true);
  const response = app.context.doPost({ postData: { contents: JSON.stringify({ formType: 'Waitlist' }) } });
  assert.match(JSON.parse(response.text).error, /Write failed/);
  assert.equal(app.released(), true);
});
