import { describe, expect, it, vi } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { buildServer, listTools } from '../../src/server.js';
import type { UnifiClient } from '../../src/api/client.js';

const ENV = {
  UNIFI_CONSOLE_URL: 'https://console.example',
  UNIFI_API_KEY: 'integration-secret',
};

interface TextResult {
  content: { type: string; text: string }[];
  isError?: boolean;
}

async function connect(options: { env?: Record<string, string>; client?: UnifiClient }) {
  const built = buildServer({
    env: options.env ?? ENV,
    ...(options.client ? { client: options.client } : {}),
  });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const mcpClient = new Client({ name: 'test', version: '0.0.0' });
  await Promise.all([built.server.connect(serverTransport), mcpClient.connect(clientTransport)]);
  return mcpClient;
}

function stubClient(result: unknown = { ok: true }) {
  const request = vi.fn().mockResolvedValue(result);
  return { stub: { request } as unknown as UnifiClient, request };
}

describe('MCP server end-to-end (in-memory transport)', () => {
  it('lists 15 tools with annotations', async () => {
    const mcp = await connect({ env: ENV });
    const { tools } = await mcp.listTools();
    expect(tools).toHaveLength(15);
    const names = tools.map((t) => t.name);
    expect(names).toContain('unifi_devices');
    expect(names).toContain('unifi_spec');
    const switching = tools.find((t) => t.name === 'unifi_switching');
    expect(switching?.annotations?.readOnlyHint).toBe(true);
    const networks = tools.find((t) => t.name === 'unifi_networks');
    expect(networks?.annotations?.destructiveHint).toBe(true);
  });

  it('dispatches a read call to the API client', async () => {
    const { stub, request } = stubClient({
      offset: 0,
      limit: 25,
      count: 0,
      totalCount: 0,
      data: [],
    });
    const mcp = await connect({ client: stub });
    const result = (await mcp.callTool({
      name: 'unifi_sites',
      arguments: { operation: 'list' },
    })) as TextResult;
    expect(result.isError).toBeFalsy();
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'GET', pathTemplate: '/v1/sites' }),
    );
    expect(result.content[0]!.text).toContain('totalCount');
  });

  it('refuses a destructive call without confirm and does not touch the API', async () => {
    const { stub, request } = stubClient();
    const mcp = await connect({ client: stub });
    const result = (await mcp.callTool({
      name: 'unifi_networks',
      arguments: { operation: 'delete', siteId: 's1', networkId: 'n1' },
    })) as TextResult;
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain('confirm: true');
    expect(request).not.toHaveBeenCalled();
  });

  it('executes a confirmed destructive call', async () => {
    const { stub, request } = stubClient({ ok: true });
    const mcp = await connect({ client: stub });
    const result = (await mcp.callTool({
      name: 'unifi_networks',
      arguments: { operation: 'delete', siteId: 's1', networkId: 'n1', confirm: true },
    })) as TextResult;
    expect(result.isError).toBeFalsy();
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'DELETE',
        pathTemplate: '/v1/sites/{siteId}/networks/{networkId}',
        pathParams: { siteId: 's1', networkId: 'n1' },
      }),
    );
  });

  it('rejects a body that violates the vendor schema before any request', async () => {
    const { stub, request } = stubClient();
    const mcp = await connect({ client: stub });
    const result = (await mcp.callTool({
      name: 'unifi_vouchers',
      arguments: {
        operation: 'generate',
        siteId: 's1',
        body: { name: 'x', timeLimitMinutes: 'sixty' },
      },
    })) as TextResult;
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain('timeLimitMinutes');
    expect(request).not.toHaveBeenCalled();
  });

  it('serves the vendor contract through unifi_spec without configuration', async () => {
    const mcp = await connect({ env: {} });
    const result = (await mcp.callTool({
      name: 'unifi_spec',
      arguments: { operation: 'unifi_vouchers.generate' },
    })) as TextResult;
    expect(result.isError).toBeFalsy();
    expect(result.content[0]!.text).toContain('timeLimitMinutes');
  });

  it('reports missing configuration as a tool error, not a crash', async () => {
    const mcp = await connect({ env: {} });
    const result = (await mcp.callTool({
      name: 'unifi_sites',
      arguments: { operation: 'list' },
    })) as TextResult;
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain('UNIFI_CONSOLE_URL');
  });

  it('redacts the API key if it ever appears in an upstream error', async () => {
    const request = vi.fn().mockRejectedValue(new Error(`boom integration-secret`));
    const mcp = await connect({ client: { request } as unknown as UnifiClient });
    const result = (await mcp.callTool({
      name: 'unifi_sites',
      arguments: { operation: 'list' },
    })) as TextResult;
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).not.toContain('integration-secret');
  });
});

describe('listTools purity', () => {
  it('is stable and needs no configuration', () => {
    const first = listTools();
    const second = listTools();
    expect(first).toHaveLength(15);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });
});
