#!/usr/bin/env node
/**
 * Generates src/generated/op-map.json and src/generated/spec-schemas.json
 * from the committed vendor contract at docs/reference/openapi.json.
 *
 * - op-map.json: one entry per documented operation, grouped into the
 *   resource-grouped tool surface approved in RFC-004 D1.
 * - spec-schemas.json: the vendor component schemas (with discriminator
 *   mappings expanded to anyOf so Ajv validates them meaningfully),
 *   registered at runtime under the $id "unifi-spec".
 *
 * Run: npm run generate   (output is committed; CI verifies it is current)
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const spec = JSON.parse(readFileSync(join(root, 'docs/reference/openapi.json'), 'utf8'));

/** Curated operationId -> { tool, op } map (AI-facing naming per ai-interface-standard). */
const NAMES = {
  getInfo: ['unifi_info', 'get'],
  getSiteOverviewPage: ['unifi_sites', 'list'],

  getPendingDevicePage: ['unifi_devices', 'list_pending'],
  getAdoptedDeviceOverviewPage: ['unifi_devices', 'list'],
  getAdoptedDeviceDetails: ['unifi_devices', 'get'],
  getAdoptedDeviceLatestStatistics: ['unifi_devices', 'get_statistics'],
  adoptDevice: ['unifi_devices', 'adopt'],
  removeDevice: ['unifi_devices', 'remove'],
  executeAdoptedDeviceAction: ['unifi_devices', 'execute_action'],
  executePortAction: ['unifi_devices', 'execute_port_action'],

  getConnectedClientOverviewPage: ['unifi_clients', 'list'],
  getConnectedClientDetails: ['unifi_clients', 'get'],
  executeConnectedClientAction: ['unifi_clients', 'execute_action'],

  getNetworksOverviewPage: ['unifi_networks', 'list'],
  getNetworkDetails: ['unifi_networks', 'get'],
  getNetworkReferences: ['unifi_networks', 'get_references'],
  createNetwork: ['unifi_networks', 'create'],
  updateNetwork: ['unifi_networks', 'update'],
  deleteNetwork: ['unifi_networks', 'delete'],

  getWifiBroadcastPage: ['unifi_wifi_broadcasts', 'list'],
  getWifiBroadcastDetails: ['unifi_wifi_broadcasts', 'get'],
  createWifiBroadcast: ['unifi_wifi_broadcasts', 'create'],
  updateWifiBroadcast: ['unifi_wifi_broadcasts', 'update'],
  deleteWifiBroadcast: ['unifi_wifi_broadcasts', 'delete'],

  getFirewallPolicies: ['unifi_firewall_policies', 'list'],
  getFirewallPolicy: ['unifi_firewall_policies', 'get'],
  createFirewallPolicy: ['unifi_firewall_policies', 'create'],
  updateFirewallPolicy: ['unifi_firewall_policies', 'update'],
  patchFirewallPolicy: ['unifi_firewall_policies', 'patch'],
  deleteFirewallPolicy: ['unifi_firewall_policies', 'delete'],
  getFirewallPolicyOrdering: ['unifi_firewall_policies', 'get_ordering'],
  updateFirewallPolicyOrdering: ['unifi_firewall_policies', 'update_ordering'],

  getFirewallZones: ['unifi_firewall_zones', 'list'],
  getFirewallZone: ['unifi_firewall_zones', 'get'],
  createFirewallZone: ['unifi_firewall_zones', 'create'],
  updateFirewallZone: ['unifi_firewall_zones', 'update'],
  deleteFirewallZone: ['unifi_firewall_zones', 'delete'],

  getAclRulePage: ['unifi_acl_rules', 'list'],
  getAclRule: ['unifi_acl_rules', 'get'],
  createAclRule: ['unifi_acl_rules', 'create'],
  updateAclRule: ['unifi_acl_rules', 'update'],
  deleteAclRule: ['unifi_acl_rules', 'delete'],
  getAclRuleOrdering: ['unifi_acl_rules', 'get_ordering'],
  updateAclRuleOrdering: ['unifi_acl_rules', 'update_ordering'],

  getDnsPolicyPage: ['unifi_dns_policies', 'list'],
  getDnsPolicy: ['unifi_dns_policies', 'get'],
  createDnsPolicy: ['unifi_dns_policies', 'create'],
  updateDnsPolicy: ['unifi_dns_policies', 'update'],
  deleteDnsPolicy: ['unifi_dns_policies', 'delete'],

  getTrafficMatchingLists: ['unifi_traffic_matching_lists', 'list'],
  getTrafficMatchingList: ['unifi_traffic_matching_lists', 'get'],
  createTrafficMatchingList: ['unifi_traffic_matching_lists', 'create'],
  updateTrafficMatchingList: ['unifi_traffic_matching_lists', 'update'],
  deleteTrafficMatchingList: ['unifi_traffic_matching_lists', 'delete'],

  getVouchers: ['unifi_vouchers', 'list'],
  getVoucher: ['unifi_vouchers', 'get'],
  createVouchers: ['unifi_vouchers', 'generate'],
  deleteVoucher: ['unifi_vouchers', 'delete'],
  deleteVouchers: ['unifi_vouchers', 'delete_by_filter'],

  getLagPage: ['unifi_switching', 'list_lags'],
  getLag: ['unifi_switching', 'get_lag'],
  getMcLagDomainPage: ['unifi_switching', 'list_mc_lag_domains'],
  getMcLagDomain: ['unifi_switching', 'get_mc_lag_domain'],
  getSwitchStackPage: ['unifi_switching', 'list_switch_stacks'],
  getSwitchStack: ['unifi_switching', 'get_switch_stack'],

  getCountries: ['unifi_supporting', 'list_countries'],
  getDpiApplications: ['unifi_supporting', 'list_dpi_applications'],
  getDpiApplicationCategories: ['unifi_supporting', 'list_dpi_categories'],
  getDeviceTagPage: ['unifi_supporting', 'list_device_tags'],
  getRadiusProfileOverviewPage: ['unifi_supporting', 'list_radius_profiles'],
  getVpnServerPage: ['unifi_supporting', 'list_vpn_servers'],
  getSiteToSiteVpnTunnelPage: ['unifi_supporting', 'list_site_to_site_vpn_tunnels'],
  getWansOverviewPage: ['unifi_supporting', 'list_wans'],
};

const TOOL_TITLES = {
  unifi_info: 'UniFi Network application info',
  unifi_sites: 'Sites on this UniFi Network console',
  unifi_devices: 'UniFi devices (adoption, details, statistics, restart, PoE port power-cycle)',
  unifi_clients: 'Connected clients (list, details, guest authorization)',
  unifi_networks: 'Networks (VLANs/subnets) configuration',
  unifi_wifi_broadcasts: 'WiFi broadcasts (SSIDs) configuration',
  unifi_firewall_policies: 'Firewall policies and their ordering',
  unifi_firewall_zones: 'Firewall zones',
  unifi_acl_rules: 'ACL rules and their ordering',
  unifi_dns_policies: 'DNS policies',
  unifi_traffic_matching_lists: 'Traffic matching lists',
  unifi_vouchers: 'Hotspot vouchers',
  unifi_switching: 'Switching read-only views (LAGs, MC-LAG domains, switch stacks)',
  unifi_supporting: 'Supporting resources (countries, DPI, device tags, RADIUS, VPN, WANs)',
};

/**
 * Point-of-use expansion of a discriminated request-body schema.
 *
 * The vendor pattern is: base schema with discriminator.mapping, and variant
 * schemas that allOf-reference the base. Expanding the base itself to anyOf
 * would create infinite mutual recursion (variant -> base -> variant), so the
 * component schemas are registered VERBATIM and only the operation's entry
 * point becomes an anyOf — with the discriminator value const-pinned per
 * branch so a bogus action/type fails locally.
 *
 * Nested discriminated unions (e.g. "Firewall policy action" inside a policy
 * body) are validated shallowly — base fields only. Documented in
 * docs/compatibility.md; the API remains the final arbiter.
 */
function expandBody(schema) {
  const refName = schema?.$ref?.startsWith('#/components/schemas/')
    ? schema.$ref.slice('#/components/schemas/'.length)
    : null;
  const target = refName ? spec.components.schemas[refName] : schema;
  const disc = target?.discriminator;
  if (!disc?.mapping || !disc.propertyName) return null;
  return {
    ...(target.description ? { description: target.description } : {}),
    anyOf: Object.entries(disc.mapping).map(([value, $ref]) => ({
      allOf: [
        { $ref },
        {
          type: 'object',
          properties: { [disc.propertyName]: { const: value } },
          required: [disc.propertyName],
        },
      ],
    })),
    'x-discriminator': disc.propertyName,
  };
}

function classify(method, path) {
  const m = method.toUpperCase();
  if (m === 'GET') return 'read';
  if (m === 'DELETE') return 'destructive';
  if (m === 'PUT' || m === 'PATCH') return 'update';
  if (m === 'POST') return path.endsWith('/actions') ? 'admin' : 'create';
  throw new Error(`unclassifiable: ${m} ${path}`);
}

/** Rewrite internal refs so extracted subtrees resolve against the registered spec doc. */
function reroot(node) {
  if (Array.isArray(node)) return node.map(reroot);
  if (node === null || typeof node !== 'object') return node;
  const out = {};
  for (const [k, v] of Object.entries(node)) {
    out[k] =
      k === '$ref' && typeof v === 'string' && v.startsWith('#/') ? `unifi-spec${v}` : reroot(v);
  }
  return out;
}

const tools = {};
let opCount = 0;
for (const [path, methods] of Object.entries(spec.paths)) {
  const pathLevelParams = methods.parameters ?? [];
  for (const [method, op] of Object.entries(methods)) {
    if (!['get', 'post', 'put', 'delete', 'patch'].includes(method)) continue;
    const mapping = NAMES[op.operationId];
    if (!mapping) throw new Error(`No curated name for operationId ${op.operationId}`);
    const [toolName, opName] = mapping;
    const params = [...pathLevelParams, ...(op.parameters ?? [])];
    const pathParams = params
      .filter((p) => p.in === 'path')
      .map((p) => ({ name: p.name, schema: reroot(p.schema ?? { type: 'string' }) }));
    const queryParams = params
      .filter((p) => p.in === 'query')
      .map((p) => ({
        name: p.name,
        required: Boolean(p.required),
        schema: reroot(p.schema ?? { type: 'string' }),
        ...(p.description ? { description: p.description } : {}),
      }));
    const bodySchemaRaw = op.requestBody?.content?.['application/json']?.schema;
    const bodySchema = bodySchemaRaw ? reroot(expandBody(bodySchemaRaw) ?? bodySchemaRaw) : null;
    const entry = {
      opId: op.operationId,
      method: method.toUpperCase(),
      path,
      class: classify(method, path),
      summary: op.summary ?? op.operationId,
      pathParams,
      queryParams,
      bodyRequired: Boolean(op.requestBody?.required),
      bodySchema,
      responseSchema: op.responses?.['200']?.content?.['application/json']?.schema
        ? reroot(op.responses['200'].content['application/json'].schema)
        : null,
    };
    tools[toolName] ??= { title: TOOL_TITLES[toolName], ops: {} };
    if (tools[toolName].ops[opName]) throw new Error(`duplicate op ${toolName}.${opName}`);
    tools[toolName].ops[opName] = entry;
    opCount += 1;
  }
}

if (opCount !== 73) throw new Error(`expected 73 operations, mapped ${opCount}`);
for (const t of Object.keys(TOOL_TITLES)) if (!tools[t]) throw new Error(`empty tool ${t}`);

const opMap = {
  apiVersion: spec.info.version,
  generatedFrom: 'docs/reference/openapi.json',
  operationCount: opCount,
  tools,
};

// Component schemas are registered VERBATIM (see expandBody for why).
const specSchemas = {
  $id: 'unifi-spec',
  components: { schemas: spec.components.schemas },
};

const outDir = join(root, 'src/generated');
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'op-map.json'), JSON.stringify(opMap, null, 1) + '\n');
writeFileSync(join(outDir, 'spec-schemas.json'), JSON.stringify(specSchemas) + '\n');
console.log(
  `generated op-map.json (${opCount} ops, ${Object.keys(tools).length} tools) and spec-schemas.json (${Object.keys(spec.components.schemas).length} schemas) for API v${spec.info.version}`,
);
