import { describe, it, expect, vi } from 'vitest';
import { getPlanDayIndex } from '../utils/planUtils';
import { hapticFeedback } from '../utils/haptic';

describe('getPlanDayIndex', () => {
  it('returns -1 when planStartStr is null', () => {
    expect(getPlanDayIndex('2026-01-13', null, 7)).toBe(-1);
  });

  it('returns -1 when date is before plan start', () => {
    expect(getPlanDayIndex('2026-01-05', '2026-01-10', 7)).toBe(-1);
  });

  it('returns 0 for the plan start date', () => {
    expect(getPlanDayIndex('2026-01-10', '2026-01-10', 7)).toBe(0);
  });

  it('returns correct index within the first cycle', () => {
    expect(getPlanDayIndex('2026-01-11', '2026-01-10', 7)).toBe(1);
    expect(getPlanDayIndex('2026-01-16', '2026-01-10', 7)).toBe(6);
  });

  it('wraps around using modulo for dates beyond plan duration', () => {
    expect(getPlanDayIndex('2026-01-17', '2026-01-10', 7)).toBe(0);
    expect(getPlanDayIndex('2026-01-18', '2026-01-10', 7)).toBe(1);
  });

  it('handles 0 planDuration gracefully', () => {
    expect(getPlanDayIndex('2026-01-10', '2026-01-10', 0)).toBe(-1);
  });

  it('works with non-7 durations', () => {
    expect(getPlanDayIndex('2026-01-10', '2026-01-06', 3)).toBe(1);
    expect(getPlanDayIndex('2026-01-12', '2026-01-06', 3)).toBe(0);
  });
});

describe('hapticFeedback', () => {
  it('does not throw when navigator.vibrate is unavailable', () => {
    const original = navigator.vibrate;
    (navigator as any).vibrate = undefined;
    expect(() => hapticFeedback(50)).not.toThrow();
    (navigator as any).vibrate = original;
  });

  it('calls navigator.vibrate when available', () => {
    const fn = vi.fn();
    (navigator as any).vibrate = fn;
    hapticFeedback(50);
    expect(fn).toHaveBeenCalledWith(50);
  });

  it('defaults to 50ms pattern', () => {
    const fn = vi.fn();
    (navigator as any).vibrate = fn;
    hapticFeedback();
    expect(fn).toHaveBeenCalledWith(50);
  });
});

describe('password strength validation', () => {
  type Strength = 'weak' | 'good' | 'strong';

  function getPasswordStrength(password: string): Strength {
    let score = 0;
    if (password.length >= 6)  score++;
    if (password.length >= 10) score++;
    if (password.length >= 14) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    if (score <= 2) return 'weak';
    if (score <= 4) return 'good';
    return 'strong';
  }

  it('returns weak for short or simple passwords', () => {
    expect(getPasswordStrength('ab')).toBe('weak');
    expect(getPasswordStrength('abc123')).toBe('weak');
  });

  it('returns good for moderately strong passwords', () => {
    expect(getPasswordStrength('Abcdef1234')).toBe('good');
  });

  it('returns strong for long complex passwords', () => {
    expect(getPasswordStrength('Abcdef1234!@#$')).toBe('strong');
  });
});

describe('username format validation', () => {
  function validateUsernameFormat(username: string): string | null {
    const RE = /^[A-Za-z0-9_]+$/;
    const RESERVED = new Set(['admin', 'root', 'system', 'support', 'help', 'dietplan', 'api', 'null', 'undefined']);
    if (/\s/.test(username))                return 'Username cannot contain spaces';
    if (username.length < 3 || username.length > 20) return 'Username must be 3\u201320 characters';
    if (!RE.test(username))                  return 'Only letters, numbers and _ allowed';
    if (RESERVED.has(username.toLowerCase())) return 'This username is not available';
    return null;
  }

  it('rejects too-short usernames', () => {
    expect(validateUsernameFormat('ab')).toBe('Username must be 3\u201320 characters');
    expect(validateUsernameFormat('')).toBe('Username must be 3\u201320 characters');
  });

  it('rejects usernames with spaces', () => {
    expect(validateUsernameFormat('hello world')).toBe('Username cannot contain spaces');
  });

  it('rejects usernames with special characters', () => {
    expect(validateUsernameFormat('hello!')).toBe('Only letters, numbers and _ allowed');
    expect(validateUsernameFormat('h\u00e9llo')).toBe('Only letters, numbers and _ allowed');
  });

  it('rejects reserved usernames', () => {
    expect(validateUsernameFormat('admin')).toBe('This username is not available');
    expect(validateUsernameFormat('Admin')).toBe('This username is not available');
    expect(validateUsernameFormat('ROOT')).toBe('This username is not available');
  });

  it('accepts valid usernames', () => {
    expect(validateUsernameFormat('john_doe')).toBeNull();
    expect(validateUsernameFormat('user123')).toBeNull();
    expect(validateUsernameFormat('a_valid_user')).toBeNull();
  });
});

describe('password validation', () => {
  function validatePassword(password: string, username: string): string | null {
    if (password.length < 6)   return 'Password must be at least 6 characters';
    if (password.length > 72)  return 'Password is too long';
    if (/^\d+$/.test(password)) return 'Password cannot be all numbers';
    if (username && password.toLowerCase() === username.toLowerCase()) return 'Password cannot be your username';
    return null;
  }

  it('rejects short passwords', () => {
    expect(validatePassword('ab', 'user')).toBe('Password must be at least 6 characters');
  });

  it('rejects all-numeric passwords', () => {
    expect(validatePassword('12345678', 'user')).toBe('Password cannot be all numbers');
  });

  it('rejects password that matches username', () => {
    expect(validatePassword('myuser', 'myuser')).toBe('Password cannot be your username');
    expect(validatePassword('MYUSER', 'myuser')).toBe('Password cannot be your username');
  });

  it('rejects overly long passwords', () => {
    expect(validatePassword('a'.repeat(73), 'user')).toBe('Password is too long');
  });

  it('accepts valid passwords', () => {
    expect(validatePassword('MyStr0ng!', 'user')).toBeNull();
    expect(validatePassword('abcdef', 'user')).toBeNull();
  });
});
