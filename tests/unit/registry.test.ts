import { describe, expect, it } from 'vitest';
import {
  buildEnvelopeSchema,
  buildToolDescription,
  buildToolInputSchema,
  loadOpMap,
  resolveCall,
} from '../../src/tools/registry.js';
import { GATED_CLASSES, UnifiUsageError } from '../../src/domain/types.js';

describe('generated op map', () => {
  const map = loadOpMap();

  it('covers all 73 documented operations across 14 tools', () => {
    expect(map.operationCount).toBe(73);
    const total = Object.values(map.tools).reduce((n, t) => n + Object.keys(t.ops).length, 0);
    expect(total).toBe(73);
    expect(Object.keys(map.tools)).toHaveLength(14);
    expect(map.apiVersion).toBe('10.4.57');
  });

  it('classifies every operation into a security-standard class', () => {
    for (const tool of Object.values(map.tools)) {
      for (const op of Object.values(tool.ops)) {
        expect(['read', 'create', 'update', 'admin', 'destructive']).toContain(op.class);
      }
    }
  });

  it('every DELETE is destructive and every GET is read', () => {
    for (const tool of Object.values(map.tools)) {
      for (const op of Object.values(tool.ops)) {
        if (op.method === 'DELETE') expect(op.class).toBe('destructive');
        if (op.method === 'GET') expect(op.class).toBe('read');
      }
    }
  });
});

describe('tool schema building', () => {
  const map = loadOpMap();

  it('descriptions name the class of every operation and flag gated ones', () => {
    const desc = buildToolDescription('unifi_networks', map.tools['unifi_networks']!);
    expect(desc).toContain('- delete (Destructive): Delete Network — requires confirm: true');
    expect(desc).toContain('- list (Read): List Networks');
  });

  it('input schemas are closed objects with operation required', () => {
    for (const [, tool] of Object.entries(map.tools)) {
      const schema = buildToolInputSchema(tool);
      expect(schema['additionalProperties']).toBe(false);
      expect(schema['required']).toEqual(['operation']);
    }
  });

  it('exposes confirm only for tools with gated operations', () => {
    const switching = buildToolInputSchema(map.tools['unifi_switching']!);
    expect((switching['properties'] as Record<string, unknown>)['confirm']).toBeUndefined();
    const networks = buildToolInputSchema(map.tools['unifi_networks']!);
    expect((networks['properties'] as Record<string, unknown>)['confirm']).toBeDefined();
  });
});

describe('envelope validation', () => {
  const map = loadOpMap();
  const networks = map.tools['unifi_networks']!;

  it('rejects unknown keys (.strict per RFC-004 D1)', () => {
    const schema = buildEnvelopeSchema('list', networks.ops['list']!);
    const result = schema.safeParse({ operation: 'list', siteId: 's', bogus: 1 });
    expect(result.success).toBe(false);
  });

  it('requires confirm: true for destructive operations with an explicit message', () => {
    expect(() =>
      resolveCall('unifi_networks', { operation: 'delete', siteId: 's1', networkId: 'n1' }),
    ).toThrow(/Destructive operation \(DELETE .*\). Pass confirm: true/);
  });

  it('confirm: false is not acceptance', () => {
    expect(() =>
      resolveCall('unifi_networks', {
        operation: 'delete',
        siteId: 's1',
        networkId: 'n1',
        confirm: false,
      }),
    ).toThrow(UnifiUsageError);
  });

  it('caps limit at the documented 200', () => {
    expect(() =>
      resolveCall('unifi_networks', { operation: 'list', siteId: 's1', limit: 500 }),
    ).toThrow(/limit/);
  });

  it('resolves a valid read call into path and query params', () => {
    const call = resolveCall('unifi_clients', {
      operation: 'list',
      siteId: 's1',
      offset: 10,
      limit: 50,
      filter: "name.like('guest*')",
    });
    expect(call.op.method).toBe('GET');
    expect(call.pathParams).toEqual({ siteId: 's1' });
    expect(call.queryParams).toEqual({ offset: 10, limit: 50, filter: "name.like('guest*')" });
  });

  it('accepts a confirmed admin action with its body', () => {
    const call = resolveCall('unifi_devices', {
      operation: 'execute_action',
      siteId: 's1',
      deviceId: 'd1',
      confirm: true,
      body: { action: 'RESTART' },
    });
    expect(call.op.class).toBe('admin');
    expect(call.body).toEqual({ action: 'RESTART' });
  });

  it('rejects unknown operations with the valid list', () => {
    expect(() => resolveCall('unifi_networks', { operation: 'destroy' })).toThrow(
      /Valid operations: list/,
    );
  });

  it('rejects unknown tools', () => {
    expect(() => resolveCall('unifi_nonsense', { operation: 'list' })).toThrow(/Unknown tool/);
  });

  it('every gated operation across the surface demands confirm', () => {
    for (const [toolName, tool] of Object.entries(map.tools)) {
      for (const [opName, op] of Object.entries(tool.ops)) {
        if (!GATED_CLASSES.includes(op.class)) continue;
        const args: Record<string, unknown> = { operation: opName };
        for (const p of op.pathParams) args[p.name] = p.schema['type'] === 'integer' ? 1 : 'x';
        for (const q of op.queryParams) if (q.required) args[q.name] = 'x';
        if (op.bodySchema) args['body'] = {};
        expect(() => resolveCall(toolName, args), `${toolName}.${opName}`).toThrow(/confirm: true/);
      }
    }
  });
});
