import { describe, expect, it, vi } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { buildServer } from '../../src/server.js';
import type { UnifiClient } from '../../src/api/client.js';
import { loadOpMap } from '../../src/tools/registry.js';
import { GATED_CLASSES } from '../../src/domain/types.js';
import { BODY_FIXTURES } from '../fixtures/bodies.js';

/**
 * Every one of the 73 documented operations is exercised end-to-end through
 * the MCP layer against a stubbed API client: envelope validation, confirm
 * gating, vendor-schema body validation, and dispatch to the right method
 * and path template.
 */
const map = loadOpMap();

const cases = Object.entries(map.tools).flatMap(([toolName, tool]) =>
  Object.entries(tool.ops).map(([opName, op]) => ({ toolName, opName, op })),
);

describe('all 73 documented operations dispatch correctly', () => {
  it('covers exactly the documented surface', () => {
    expect(cases).toHaveLength(73);
  });

  it.each(cases)('$toolName.$opName ($op.method $op.path)', async ({ toolName, opName, op }) => {
    const request = vi.fn().mockResolvedValue({ ok: true });
    const built = buildServer({
      env: { UNIFI_CONSOLE_URL: 'https://console.example', UNIFI_API_KEY: 'ops-test-key' },
      client: { request } as unknown as UnifiClient,
    });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const mcp = new Client({ name: 'ops-test', version: '0.0.0' });
    await Promise.all([built.server.connect(serverTransport), mcp.connect(clientTransport)]);

    const args: Record<string, unknown> = { operation: opName };
    for (const p of op.pathParams) {
      args[p.name] = p.schema['type'] === 'integer' ? 7 : `${p.name}-value`;
    }
    for (const q of op.queryParams) {
      if (q.required) args[q.name] = q.schema['type'] === 'integer' ? 1 : "name.eq('x')";
    }
    if (GATED_CLASSES.includes(op.class)) args['confirm'] = true;
    if (op.bodySchema !== null) {
      const fixture = BODY_FIXTURES[op.opId];
      expect(fixture, `missing body fixture for ${op.opId}`).toBeDefined();
      args['body'] = fixture;
    }

    const result = (await mcp.callTool({ name: toolName, arguments: args })) as {
      isError?: boolean;
      content: { text: string }[];
    };
    expect(result.isError, result.content[0]?.text).toBeFalsy();
    expect(request).toHaveBeenCalledTimes(1);
    const spec = request.mock.calls[0]![0] as {
      method: string;
      pathTemplate: string;
      pathParams: Record<string, unknown>;
    };
    expect(spec.method).toBe(op.method);
    expect(spec.pathTemplate).toBe(op.path);
    for (const p of op.pathParams) {
      expect(spec.pathParams[p.name]).toBeDefined();
    }
  });
});
