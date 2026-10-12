/**
 * Shared email validation utility for TermJob Candidate Accounts.
 *
 * Ensures candidate self-registration uses personal email accounts and
 * prevents corporate/enterprise or company domain emails from being used.
 */

// Common personal/consumer webmail providers allowed for candidates
export const PERSONAL_EMAIL_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'msn.com',
  'yahoo.com',
  'ymail.com',
  'rocketmail.com',
  'icloud.com',
  'me.com',
  'mac.com',
  'proton.me',
  'protonmail.com',
  'aol.com',
  'zoho.com',
  'mail.com',
  'gmx.com',
  'fastmail.com',
  'hey.com',
  'pm.me',
]);

// Known enterprise company domains or company name prefixes
export const ENTERPRISE_COMPANY_PATTERNS = [
  'apple.com',
  'ibm.com',
  'roblox.com',
  'microsoft.com',
  'google.com',
  'amazon.com',
  'meta.com',
  'netflix.com',
  'oracle.com',
  'salesforce.com',
  'cisco.com',
  'intel.com',
  'nvidia.com',
  'adobe.com',
  'uber.com',
  'lyft.com',
  'stripe.com',
  'airbnb.com',
  'shopify.com',
  'spotify.com',
  'twitter.com',
  'x.com',
  'linkedin.com',
  'termjobs.com',
  'termjobs.ai',
];

/**
 * Validates whether an email is permissible for a candidate profile.
 *
 * @param {string} email
 * @param {Object} [options]
 * @param {boolean} [options.required=true]
 * @returns {string} Error message if invalid, or empty string if valid.
 */
export function validateCandidateEmail(email, { required = true } = {}) {
  const trimmed = (email || '').trim().toLowerCase();
  if (!trimmed) {
    return required ? 'Email address is required.' : '';
  }

  // Standard email format check supporting subdomains
  const emailRegex = /^[a-zA-Z0-9_.+\-]+@([a-zA-Z0-9\-]+\.)+[a-zA-Z]{2,}$/;
  if (!emailRegex.test(trimmed)) {
    return 'Please enter a valid email address.';
  }

  const parts = trimmed.split('@');
  if (parts.length !== 2) {
    return 'Please enter a valid email address.';
  }

  const domain = parts[1].toLowerCase();

  // Explicit enterprise company pattern check
  if (ENTERPRISE_COMPANY_PATTERNS.some((ed) => domain === ed || domain.endsWith('.' + ed))) {
    return `Company email address (@${domain}) is reserved for enterprise accounts. Please use your personal email (e.g. Gmail, Outlook, Yahoo) to register as a candidate.`;
  }

  // Disposable domain checks
  const disposableDomains = new Set([
    'mailinator.com',
    'tempmail.com',
    'temp-mail.org',
    'guerrillamail.com',
    'yopmail.com',
    'trashmail.com',
    '10minutemail.com',
    'dispostable.com',
  ]);
  if (disposableDomains.has(domain)) {
    return 'Disposable email addresses are not allowed. Please use your personal email address.';
  }

  return '';
}

/**
 * Returns boolean whether email is a valid personal email for candidates.
 */
export function isCandidateEmailValid(email, options) {
  return validateCandidateEmail(email, options) === '';
}
