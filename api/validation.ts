export interface ValidationResult {
  valid: boolean;
  message?: string;
}

const USERNAME_REGEX = /^[A-Za-z0-9_]{3,20}$/;
const RESERVED_USERNAMES = new Set([
  'admin', 'root', 'superuser', 'system', 'support', 'help', 'info',
  'dietplan', 'api', 'null', 'undefined', 'true', 'false', 'nan',
]);

export function validateUsername(username: string): ValidationResult {
  if (typeof username !== 'string' || username.length === 0) {
    return { valid: false, message: 'Username is required' };
  }
  if (/\s/.test(username)) {
    return { valid: false, message: 'Username cannot contain spaces' };
  }
  if (username.length < 3 || username.length > 20) {
    return { valid: false, message: 'Username must be 3\u201320 characters' };
  }
  if (!USERNAME_REGEX.test(username)) {
    return { valid: false, message: 'Only letters, numbers and _ allowed' };
  }
  if (RESERVED_USERNAMES.has(username.toLowerCase())) {
    return { valid: false, message: 'This username is not available' };
  }
  return { valid: true };
}

export function validatePassword(password: string, username: string): ValidationResult {
  if (typeof password !== 'string' || password.length === 0) {
    return { valid: false, message: 'Password is required' };
  }
  if (password.length < 6) {
    return { valid: false, message: 'Password must be at least 6 characters' };
  }
  if (password.length > 72) {
    return { valid: false, message: 'Password is too long' };
  }
  if (/^\d+$/.test(password)) {
    return { valid: false, message: 'Password cannot be all numbers' };
  }
  if (username && password.toLowerCase() === username.toLowerCase()) {
    return { valid: false, message: 'Password cannot be your username' };
  }
  return { valid: true };
}

// Deliberately permissive — we only guard against obviously malformed input
// (missing @, missing domain, spaces). Real deliverability is proven by the
// account actually receiving mail, not by a stricter regex.
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(email: string): ValidationResult {
  if (typeof email !== 'string' || email.trim().length === 0) {
    return { valid: false, message: 'Email is required' };
  }
  const e = email.trim();
  if (e.length > 254) {
    return { valid: false, message: 'Email is too long' };
  }
  if (!EMAIL_REGEX.test(e)) {
    return { valid: false, message: 'Enter a valid email address' };
  }
  return { valid: true };
}
