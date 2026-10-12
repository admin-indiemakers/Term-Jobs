import test from 'node:test';
import assert from 'node:assert/strict';

import {
  validateCandidateEmail,
  isCandidateEmailValid,
} from '../src/utils/candidateEmailValidation.js';

test('candidate email validator allows personal email providers', () => {
  const allowed = [
    'john.doe@gmail.com',
    'sarah_connor@outlook.com',
    'candidate123@yahoo.com',
    'developer@icloud.com',
    'engineer@proton.me',
    'tester@zoho.com',
    'applicant@hotmail.com',
  ];

  for (const email of allowed) {
    assert.equal(validateCandidateEmail(email), '', `Expected ${email} to be allowed`);
    assert.equal(isCandidateEmailValid(email), true, `Expected ${email} to be valid`);
  }
});

test('candidate email validator rejects enterprise/company emails', () => {
  const corporateEmails = [
    'tim.cook@apple.com',
    'recruiter@ibm.com',
    'admin@roblox.com',
    'manager@microsoft.com',
    'hiring@google.com',
    'team@subdomain.apple.com',
    'contact@termjobs.ai',
  ];

  for (const email of corporateEmails) {
    const err = validateCandidateEmail(email);
    assert.notEqual(err, '', `Expected ${email} to be blocked as corporate email`);
    assert.match(err, /Company email address|reserved for enterprise/i);
    assert.equal(isCandidateEmailValid(email), false);
  }
});

test('candidate email validator rejects disposable email domains', () => {
  const disposable = [
    'spammer@mailinator.com',
    'trash@tempmail.com',
    'temp@10minutemail.com',
  ];

  for (const email of disposable) {
    const err = validateCandidateEmail(email);
    assert.notEqual(err, '', `Expected ${email} to be rejected`);
    assert.match(err, /Disposable email addresses are not allowed/i);
  }
});

test('candidate email validator requires valid syntax', () => {
  assert.equal(validateCandidateEmail(''), 'Email address is required.');
  assert.equal(validateCandidateEmail('', { required: false }), '');
  assert.equal(validateCandidateEmail('invalid-email'), 'Please enter a valid email address.');
  assert.equal(validateCandidateEmail('missingdomain@'), 'Please enter a valid email address.');
});
