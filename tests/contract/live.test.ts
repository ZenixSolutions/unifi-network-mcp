import { describe, expect, it } from 'vitest';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { readFileSync } from 'node:fs';
import { loadConfig } from '../../src/api/config.js';
import { UnifiClient } from '../../src/api/client.js';
import { loadOpMap } from '../../src/tools/registry.js';
import type { JsonSchema } from '../../src/domain/types.js';

/**
 * Live contract verification (RFC-004 D6): read-only calls against a real
 * console, with every response validated against the vendor's own response
 * schema. Opt-in: `npm run test:contract` with UNIFI_API_KEY set, plus either
 * UNIFI_CONSOLE_URL (direct mode) or cloud mode with UNIFI_CONSOLE_ID naming
 * the console to test (required only when several are visible, per ADR-002).
 * No write operation is ever exercised here.
 */
const enabled = process.env['UNIFI_CONTRACT'] === '1';

const d = describe.skipIf(!enabled);

d('live contract (read-only)', () => {
  const { config } = loadConfig(process.env);
  const client = new UnifiClient(config);
  const map = loadOpMap();

  let cloudConsoleId: string | undefined;
  const consoleArgs = async (): Promise<{ consoleId?: string }> => {
    if (config.mode !== 'cloud') return {};
    if (!cloudConsoleId) {
      const pinned = process.env['UNIFI_CONSOLE_ID'];
      if (pinned) {
        cloudConsoleId = pinned;
      } else {
        const consoles = await client.listConsoles();
        if (consoles.length !== 1) {
          throw new Error(
            `Cloud mode: set UNIFI_CONSOLE_ID to one of: ${consoles
              .map((c) => `${c.name}=${c.id}`)
              .join(', ')}`,
          );
        }
        cloudConsoleId = consoles[0]!.id;
      }
    }
    return { consoleId: cloudConsoleId };
  };

  it('cloud mode: unifi_consoles lists at least one console', async () => {
    if (config.mode !== 'cloud') return;
    const consoles = await client.listConsoles();
    expect(consoles.length).toBeGreaterThan(0);
    for (const c of consoles) {
      expect(typeof c.id).toBe('string');
      expect(typeof c.name).toBe('string');
    }
  });

  const specDoc = JSON.parse(
    readFileSync(new URL('../../src/generated/spec-schemas.json', import.meta.url), 'utf8'),
  ) as object;
  const ajv = new Ajv2020.default({ strict: false, allErrors: true, validateFormats: false });
  addFormats.default(ajv);
  ajv.addSchema(specDoc);

  const validateAgainst = (schema: JsonSchema | null, value: unknown, label: string): void => {
    if (schema === null) return;
    const validate = ajv.compile(schema);
    const valid = validate(value);
    if (!valid) {
      const details = (validate.errors ?? [])
        .slice(0, 10)
        .map((e) => `${e.instancePath || '(root)'} ${e.message ?? ''}`)
        .join('; ');
      throw new Error(`${label}: response does not match vendor schema: ${details}`);
    }
  };

  const findOp = (toolName: string, opName: string) => {
    const op = map.tools[toolName]?.ops[opName];
    if (!op) throw new Error(`missing ${toolName}.${opName}`);
    return op;
  };

  let siteId: string | undefined;
  let deviceId: string | undefined;

  it('GET /v1/info matches the vendor schema', async () => {
    const op = findOp('unifi_info', 'get');
    const result = await client.request({
      method: 'GET',
      pathTemplate: op.path,
      pathParams: {},
      queryParams: {},
      ...(await consoleArgs()),
    });
    validateAgainst(op.responseSchema, result, op.opId);
  });

  it('GET /v1/sites matches and yields a siteId', async () => {
    const op = findOp('unifi_sites', 'list');
    const result = (await client.request({
      method: 'GET',
      pathTemplate: op.path,
      pathParams: {},
      queryParams: { offset: 0, limit: 25 },
      ...(await consoleArgs()),
    })) as { data: { id: string }[] };
    validateAgainst(op.responseSchema, result, op.opId);
    expect(result.data.length).toBeGreaterThan(0);
    siteId = result.data[0]!.id;
  });

  const siteScopedLists: [string, string][] = [
    ['unifi_devices', 'list'],
    ['unifi_clients', 'list'],
    ['unifi_networks', 'list'],
    ['unifi_wifi_broadcasts', 'list'],
    ['unifi_firewall_policies', 'list'],
    ['unifi_firewall_zones', 'list'],
    ['unifi_acl_rules', 'list'],
    ['unifi_dns_policies', 'list'],
    ['unifi_traffic_matching_lists', 'list'],
    ['unifi_vouchers', 'list'],
    ['unifi_switching', 'list_lags'],
    ['unifi_switching', 'list_mc_lag_domains'],
    ['unifi_switching', 'list_switch_stacks'],
    ['unifi_supporting', 'list_device_tags'],
    ['unifi_supporting', 'list_radius_profiles'],
    ['unifi_supporting', 'list_vpn_servers'],
    ['unifi_supporting', 'list_site_to_site_vpn_tunnels'],
    ['unifi_supporting', 'list_wans'],
  ];

  it.each(siteScopedLists)('%s.%s matches the vendor schema', async (toolName, opName) => {
    expect(siteId, 'sites list must run first').toBeDefined();
    const op = findOp(toolName, opName);
    const result = await client.request({
      method: 'GET',
      pathTemplate: op.path,
      pathParams: { siteId: siteId! },
      queryParams: op.queryParams.some((q) => q.name === 'offset') ? { offset: 0, limit: 25 } : {},
      ...(await consoleArgs()),
    });
    validateAgainst(op.responseSchema, result, op.opId);
    if (toolName === 'unifi_devices') {
      const page = result as { data: { id: string }[] };
      deviceId = page.data[0]?.id;
    }
  });

  const globalLists: [string, string][] = [
    ['unifi_supporting', 'list_countries'],
    ['unifi_supporting', 'list_dpi_applications'],
    ['unifi_supporting', 'list_dpi_categories'],
    ['unifi_devices', 'list_pending'],
  ];

  it.each(globalLists)('%s.%s matches the vendor schema', async (toolName, opName) => {
    const op = findOp(toolName, opName);
    const result = await client.request({
      method: 'GET',
      pathTemplate: op.path,
      pathParams: {},
      queryParams: op.queryParams.some((q) => q.name === 'offset') ? { offset: 0, limit: 25 } : {},
      ...(await consoleArgs()),
    });
    validateAgainst(op.responseSchema, result, op.opId);
  });

  it('device details and latest statistics match (when a device exists)', async () => {
    if (!siteId || !deviceId) return;
    const details = findOp('unifi_devices', 'get');
    const detailsResult = await client.request({
      method: 'GET',
      pathTemplate: details.path,
      pathParams: { siteId, deviceId },
      queryParams: {},
      ...(await consoleArgs()),
    });
    validateAgainst(details.responseSchema, detailsResult, details.opId);
    const stats = findOp('unifi_devices', 'get_statistics');
    const statsResult = await client.request({
      method: 'GET',
      pathTemplate: stats.path,
      pathParams: { siteId, deviceId },
      queryParams: {},
      ...(await consoleArgs()),
    });
    validateAgainst(stats.responseSchema, statsResult, stats.opId);
  });

  it('filtering works against a live list endpoint', async () => {
    expect(siteId).toBeDefined();
    const op = findOp('unifi_clients', 'list');
    const result = (await client.request({
      method: 'GET',
      pathTemplate: op.path,
      pathParams: { siteId: siteId! },
      queryParams: { offset: 0, limit: 5, filter: 'id.isNotNull()' },
      ...(await consoleArgs()),
    })) as { data: unknown[] };
    validateAgainst(op.responseSchema, result, `${op.opId} (filtered)`);
  });
});
