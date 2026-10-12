import test from 'node:test';
import assert from 'node:assert/strict';

import { validateEmail, isEmailValid } from '../src/utils/emailValidation.js';

test('company onboard email validation accepts valid corporate and standard emails', () => {
  const valid = [
    'admin@company.com',
    'hr.lead@enterprise.org',
    'contact_us@domain.co.uk',
    'john.doe+admin@sub.domain.io',
  ];

  for (const email of valid) {
    assert.equal(validateEmail(email), '', `Expected ${email} to be valid`);
    assert.equal(isEmailValid(email), true, `Expected ${email} to be valid`);
  }
});

test('company onboard email validation rejects emails with commas or typo punctuation', () => {
  const invalidPunctuation = [
    'bijokbinoy2005fdsghgjhk,@gmail.com',
    'admin,@company.com',
    'admin@company,com',
    'admin;test@company.com',
    'admin:test@company.com',
    'user name@company.com',
    '"admin"@company.com',
  ];

  for (const email of invalidPunctuation) {
    const err = validateEmail(email);
    assert.notEqual(err, '', `Expected ${email} to produce an error`);
    assert.equal(isEmailValid(email), false, `Expected ${email} to be invalid`);
    assert.match(err, /cannot contain commas, spaces, or quotes|valid email address/i);
  }
});

test('company onboard email validation rejects disposable domains', () => {
  const disposable = [
    'admin@mailinator.com',
    'admin@tempmail.com',
    'test@yopmail.com',
  ];

  for (const email of disposable) {
    const err = validateEmail(email);
    assert.notEqual(err, '', `Expected disposable ${email} to produce an error`);
    assert.equal(isEmailValid(email), false);
    assert.match(err, /Temporary email addresses/i);
  }
});

test('company onboard email validation requires non-empty value', () => {
  assert.equal(validateEmail(''), 'Email address is required.');
  assert.equal(validateEmail('   '), 'Email address is required.');
  assert.equal(isEmailValid(''), false);
});
