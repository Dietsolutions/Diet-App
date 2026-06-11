import { describe, it, expect } from 'vitest';

// SHA-256 hex of a token (replicated from auth.ts)
function hashToken(token: string): string {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(token, 'utf8').digest('hex');
}

function sanitizeText(text: string): string {
  return text.trim().replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
}

describe('hashToken', () => {
  it('produces a 64-char hex string', () => {
    const hash = hashToken('test-token-123');
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('is deterministic for the same input', () => {
    expect(hashToken('hello')).toBe(hashToken('hello'));
  });

  it('produces different hashes for different inputs', () => {
    expect(hashToken('token-a')).not.toBe(hashToken('token-b'));
  });
});

describe('sanitizeText', () => {
  it('trims whitespace', () => {
    expect(sanitizeText('  hello  ')).toBe('hello');
  });

  it('removes control characters', () => {
    expect(sanitizeText('hello\x00world\x1F')).toBe('helloworld');
  });

  it('preserves normal text', () => {
    expect(sanitizeText('Hello, World!')).toBe('Hello, World!');
  });

  it('handles empty string', () => {
    expect(sanitizeText('')).toBe('');
  });
});
