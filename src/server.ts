import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { loadConfig, type UnifiConfig } from './api/config.js';
import { UnifiClient } from './api/client.js';
import { getBodyValidator } from './api/validate.js';
import { makeRedactor } from './api/redact.js';
import { formatResult } from './presentation/format.js';
import {
  buildToolDescription,
  buildToolInputSchema,
  loadOpMap,
  resolveCall,
} from './tools/registry.js';
import {
  SPEC_TOOL_DESCRIPTION,
  SPEC_TOOL_INPUT_SCHEMA,
  SPEC_TOOL_NAME,
  describeOperation,
} from './tools/spec.js';
import {
  CONSOLES_TOOL_DESCRIPTION,
  CONSOLES_TOOL_INPUT_SCHEMA,
  CONSOLES_TOOL_NAME,
  parseConsolesInput,
} from './tools/consoles.js';
import { GATED_CLASSES, UnifiApiError, UnifiUsageError } from './domain/types.js';

export const SERVER_NAME = 'unifi-network-mcp';

export interface BuiltServer {
  readonly server: Server;
  readonly warnings: readonly string[];
}

export interface ToolListing {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: Record<string, unknown>;
  readonly annotations: Record<string, unknown>;
}

/** The full tool listing, derived from the generated op map. Pure; no config needed. */
export function listTools(): ToolListing[] {
  const map = loadOpMap();
  const tools: ToolListing[] = Object.entries(map.tools).map(([name, tool]) => {
    const classes = new Set(Object.values(tool.ops).map((op) => op.class));
    return {
      name,
      description: buildToolDescription(name, tool),
      inputSchema: buildToolInputSchema(tool),
      annotations: {
        title: tool.title,
        readOnlyHint: [...classes].every((c) => c === 'read'),
        destructiveHint: [...classes].some((c) => GATED_CLASSES.includes(c)),
      },
    };
  });
  tools.push({
    name: SPEC_TOOL_NAME,
    description: SPEC_TOOL_DESCRIPTION,
    inputSchema: SPEC_TOOL_INPUT_SCHEMA as unknown as Record<string, unknown>,
    annotations: { title: 'Vendor API contract lookup', readOnlyHint: true },
  });
  tools.push({
    name: CONSOLES_TOOL_NAME,
    description: CONSOLES_TOOL_DESCRIPTION,
    inputSchema: CONSOLES_TOOL_INPUT_SCHEMA as unknown as Record<string, unknown>,
    annotations: { title: 'Console discovery (cloud mode)', readOnlyHint: true },
  });
  return tools;
}

export interface BuildOptions {
  readonly env?: Readonly<Record<string, string | undefined>>;
  /** Test seam: substitute the HTTP client. */
  readonly client?: UnifiClient;
}

/**
 * Builds the MCP server. Exported as a factory — importing this module has no
 * side effects and starts no transport (RFC-001 D2: main must not point at an
 * executable; the NetBox A2 defect class).
 */
export function buildServer(options: BuildOptions = {}): BuiltServer {
  const env = options.env ?? process.env;
  let config: UnifiConfig | undefined;
  let warnings: readonly string[] = [];
  let configError: UnifiUsageError | undefined;
  try {
    const loaded = loadConfig(env);
    config = loaded.config;
    warnings = loaded.warnings;
  } catch (error) {
    if (error instanceof UnifiUsageError) configError = error;
    else throw error;
  }
  const client = options.client ?? (config ? new UnifiClient(config) : undefined);
  const redact = makeRedactor(config ? [config.apiKey] : []);

  const map = loadOpMap();
  const server = new Server(
    { name: SERVER_NAME, version: PACKAGE_VERSION },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, () => ({ tools: listTools() }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    try {
      if (name === SPEC_TOOL_NAME) {
        return ok(formatResult(describeOperation(args), redact));
      }
      if (name !== CONSOLES_TOOL_NAME && !(name in map.tools)) {
        throw new UnifiUsageError(`Unknown tool "${name}"`);
      }
      if (!client) {
        throw (
          configError ??
          new UnifiUsageError(
            'Server is not configured; set UNIFI_API_KEY (and optionally UNIFI_CONSOLE_URL).',
          )
        );
      }
      if (name === CONSOLES_TOOL_NAME) {
        const { refresh } = parseConsolesInput(args);
        return ok(formatResult(await client.listConsoles(refresh), redact));
      }
      const call = resolveCall(name, args);
      if (call.op.bodySchema !== null && call.body !== undefined) {
        getBodyValidator()(call.op.bodySchema, call.body);
      }
      let consoleId = call.consoleId;
      if (client.mode === 'cloud' && consoleId === undefined) {
        const consoles = await client.listConsoles();
        const only = consoles.length === 1 ? consoles[0] : undefined;
        if (only) {
          consoleId = only.id;
        } else {
          const listing = consoles.map((c) => `- ${c.name} (consoleId: ${c.id})`).join('\n');
          throw new UnifiUsageError(
            consoles.length === 0
              ? 'No consoles are visible to this API key (Site Manager /v1/hosts returned none).'
              : `Multiple consoles are visible to this API key — retry with a consoleId:\n${listing}`,
          );
        }
      }
      const result = await client.request({
        method: call.op.method,
        pathTemplate: call.op.path,
        pathParams: call.pathParams,
        queryParams: call.queryParams,
        ...(call.body === undefined ? {} : { body: call.body }),
        ...(consoleId === undefined ? {} : { consoleId }),
      });
      return ok(formatResult(result, redact));
    } catch (error) {
      if (error instanceof UnifiUsageError || error instanceof UnifiApiError) {
        return { content: [{ type: 'text', text: redact(error.message) }], isError: true };
      }
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text', text: redact(`Unexpected error: ${message}`) }],
        isError: true,
      };
    }
  });

  return { server, warnings };
}

function ok(text: string): { content: { type: 'text'; text: string }[] } {
  return { content: [{ type: 'text', text }] };
}

/** Must match package.json; asserted by tests/version.test.ts. */
export const PACKAGE_VERSION = '0.1.0';
