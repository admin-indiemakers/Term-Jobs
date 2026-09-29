/**
 * Shared email validation utility for TermJob admin forms.
 * Validates format + blocks common disposable/fake domains.
 */

const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com', 'guerrillamail.com', 'guerrillamail.net', 'guerrillamail.org',
  'guerrillamail.biz', 'guerrillamail.de', 'guerrillamail.info',
  'tempmail.com', 'temp-mail.org', 'throwam.com', 'throwam.net',
  'yopmail.com', 'yopmail.fr', 'sharklasers.com', 'guerrillamailblock.com',
  'grr.la', 'spam4.me', 'trashmail.com', 'trashmail.me', 'trashmail.net',
  'trashmail.at', 'trashmail.io', 'trashmail.org', 'dispostable.com',
  'mailnull.com', 'fakeinbox.com', 'maildrop.cc', 'mailnesia.com',
  'spamgourmet.com', 'spamgourmet.net', 'spamgourmet.org',
  '10minutemail.com', '10minutemail.net', '10minutemail.org',
  '20minutemail.com', 'tempr.email', 'discard.email', 'spambog.com',
  'spambog.de', 'spambog.ru', 'getairmail.com', 'filzmail.com',
  'mailzilla.org', 'mohmal.com', 'mailseal.de', 'incognitomail.com',
  'armyspy.com', 'cuvox.de', 'dayrep.com', 'einrot.com', 'fleckens.hu',
  'gustr.com', 'jourrapide.com', 'rhyta.com', 'superrito.com', 'teleworm.us',
]);

const EMAIL_REGEX = /^[a-zA-Z0-9_.+\-]+@[a-zA-Z0-9\-]+\.[a-zA-Z]{2,}$/;

/**
 * Returns an error string or empty string if valid.
 * @param {string} email
 * @returns {string}
 */
export function validateEmail(email) {
  const trimmed = (email || '').trim().toLowerCase();
  if (!trimmed) return 'Email address is required.';
  if (!EMAIL_REGEX.test(trimmed)) return 'Please enter a valid email address (e.g. name@company.com).';
  const domain = trimmed.split('@')[1];
  if (DISPOSABLE_DOMAINS.has(domain)) {
    return `Temporary email addresses (${domain}) are not allowed. Please use a real email.`;
  }
  return '';
}

/**
 * Returns true if the email passes all client-side validation.
 * @param {string} email
 * @returns {boolean}
 */
export function isEmailValid(email) {
  return validateEmail(email) === '';
}
