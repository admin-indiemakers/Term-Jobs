import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCompanyProfilePayload } from './companyProfilePayload.js';

const company = {
  name: 'BEARITT', industry: 'Technology', size: '1-10', location: ' kochi ',
  notes: '', logo_url: '', tech_stack: [],
};
const admin = { admin_name: 'Admin', admin_email: 'admin@example.com', admin_phone: '' };

test('headquarters edit leaves the unchanged company name out of the request', () => {
  const payload = buildCompanyProfilePayload(company, admin, 'BEARITT');
  assert.equal(payload.location, 'kochi');
  assert.equal(Object.hasOwn(payload, 'name'), false);
});

test('a deliberate company rename is included in the request', () => {
  const payload = buildCompanyProfilePayload({ ...company, name: 'BEARITT Labs' }, admin, 'BEARITT');
  assert.equal(payload.name, 'BEARITT Labs');
});
