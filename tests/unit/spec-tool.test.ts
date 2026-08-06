import { describe, expect, it } from 'vitest';
import { describeOperation, deref } from '../../src/tools/spec.js';
import { loadOpMap } from '../../src/tools/registry.js';
import { UnifiUsageError } from '../../src/domain/types.js';

describe('unifi_spec', () => {
  it('returns a dereferenced body schema for a create operation', () => {
    const result = describeOperation({ operation: 'unifi_networks.create' }) as {
      class: string;
      bodySchema: unknown;
      responseSchema: unknown;
    };
    expect(result.class).toBe('create');
    expect(result.bodySchema).not.toBeNull();
    const text = JSON.stringify(result.bodySchema);
    expect(text).toContain('GATEWAY');
    expect(text).not.toContain('unifi-spec#'); // fully resolved or explicitly marked
  });

  it('is cycle-safe across the whole surface', () => {
    const map = loadOpMap();
    for (const [toolName, tool] of Object.entries(map.tools)) {
      for (const opName of Object.keys(tool.ops)) {
        expect(() => describeOperation({ operation: `${toolName}.${opName}` })).not.toThrow();
      }
    }
  });

  it('rejects unknown tools and operations with guidance', () => {
    expect(() => describeOperation({ operation: 'bogus.list' })).toThrow(/Unknown tool/);
    expect(() => describeOperation({ operation: 'unifi_sites.destroy' })).toThrow(
      /Valid operations/,
    );
    expect(() => describeOperation({ operation: 'not-a-pair' })).toThrow(UnifiUsageError);
  });

  it('marks unresolvable and circular refs instead of failing', () => {
    expect(deref({ $ref: 'unifi-spec#/components/schemas/DoesNotExist' })).toEqual({
      $unresolved: 'unifi-spec#/components/schemas/DoesNotExist',
    });
  });
});
