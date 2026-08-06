import { describe, expect, it } from 'vitest';
import { makeRedactor } from '../../src/api/redact.js';

describe('makeRedactor', () => {
  it('removes every occurrence of the secret', () => {
    const redact = makeRedactor(['s3cret']);
    expect(redact('key=s3cret and again s3cret!')).toBe('key=[REDACTED] and again [REDACTED]!');
  });

  it('handles multiple secrets', () => {
    const redact = makeRedactor(['aaa', 'bbb']);
    expect(redact('aaa/bbb')).toBe('[REDACTED]/[REDACTED]');
  });

  it('ignores empty secrets instead of corrupting output', () => {
    const redact = makeRedactor(['']);
    expect(redact('plain text')).toBe('plain text');
  });
});
