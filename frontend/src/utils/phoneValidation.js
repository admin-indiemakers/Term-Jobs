/**
 * Shared mobile phone validation utility for TermJob.
 * Validates digit count and format:
 * - Minimum 10 digits (standard mobile number length)
 * - Domestic / national numbers (without '+'): exactly 10 digits
 * - International numbers (starting with '+'): between 10 and 15 digits (E.164 standard)
 * - Disallows invalid characters (letters, symbols other than +, -, (), ., and spaces)
 */

export function validatePhone(phone, { required = true } = {}) {
  const trimmed = (phone || '').trim();
  if (!trimmed) {
    return required ? 'Phone number is required.' : '';
  }

  // Check for allowed characters: numbers, spaces, +, -, (, ), .
  if (!/^\+?[0-9\s\-().]+$/.test(trimmed)) {
    return 'Please enter a valid mobile number (digits and standard formatting only).';
  }

  // Extract only digits
  const digits = trimmed.replace(/\D/g, '');

  if (trimmed.startsWith('+')) {
    if (digits.length < 10) {
      return 'Mobile number must be at least 10 digits.';
    }
    if (digits.length > 15) {
      return 'Mobile number cannot exceed 15 digits.';
    }
  } else {
    if (digits.length < 10) {
      return 'Mobile number must be at least 10 digits.';
    }
    if (digits.length > 10) {
      return 'Mobile number cannot exceed 10 digits (use + for country code).';
    }
  }

  return '';
}

export function isPhoneValid(phone, options) {
  return validatePhone(phone, options) === '';
}
