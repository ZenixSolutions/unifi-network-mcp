import { describe, expect, it } from 'vitest';
import { MAX_RESULT_CHARS, formatResult } from '../../src/presentation/format.js';

const identity = (t: string): string => t;

describe('formatResult', () => {
  it('pretty-prints small results untouched', () => {
    expect(formatResult({ a: 1 }, identity)).toBe('{\n "a": 1\n}');
  });

  it('truncates oversized results with an explicit note', () => {
    const big = { data: 'x'.repeat(MAX_RESULT_CHARS * 2) };
    const out = formatResult(big, identity);
    expect(out.length).toBeLessThan(MAX_RESULT_CHARS + 200);
    expect(out).toContain('truncated');
  });

  it('applies redaction to the serialized output', () => {
    const out = formatResult({ note: 'contains secret-x' }, (t) =>
      t.replaceAll('secret-x', '[REDACTED]'),
    );
    expect(out).toContain('[REDACTED]');
    expect(out).not.toContain('secret-x');
  });
});
