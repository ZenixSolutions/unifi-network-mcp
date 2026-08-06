import { readFileSync } from 'node:fs';
import { z } from 'zod';
import { loadOpMap } from './registry.js';
import { UnifiUsageError } from '../domain/types.js';

const specInput = z
  .object({
    operation: z
      .string()
      .regex(
        /^[a-z_]+\.[a-z_]+$/,
        'Use the form "<tool>.<operation>", e.g. "unifi_networks.create"',
      ),
  })
  .strict();

let componentsDoc: { components: { schemas: Record<string, unknown> } } | undefined;

function loadComponents(): { components: { schemas: Record<string, unknown> } } {
  componentsDoc ??= JSON.parse(
    readFileSync(new URL('../generated/spec-schemas.json', import.meta.url), 'utf8'),
  ) as { components: { schemas: Record<string, unknown> } };
  return componentsDoc;
}

const MAX_DEPTH = 12;

/** Dereference unifi-spec#/components/schemas/... refs, cycle-safe and depth-limited. */
export function deref(node: unknown, stack: readonly string[] = []): unknown {
  if (Array.isArray(node)) return node.map((n) => deref(n, stack));
  if (node === null || typeof node !== 'object') return node;
  const obj = node as Record<string, unknown>;
  const ref = obj['$ref'];
  if (typeof ref === 'string') {
    const name = ref.replace(/^(unifi-spec)?#\/components\/schemas\//, '');
    if (name === ref) return { $unresolved: ref };
    if (stack.includes(name) || stack.length >= MAX_DEPTH) return { $circular: name };
    const target = loadComponents().components.schemas[name];
    if (target === undefined) return { $unresolved: ref };
    return deref(target, [...stack, name]);
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) out[k] = deref(v, stack);
  return out;
}

export const SPEC_TOOL_NAME = 'unifi_spec';

export const SPEC_TOOL_DESCRIPTION =
  'Read the committed vendor API contract (OpenAPI, UniFi Network Integration API). ' +
  'Returns the exact request-body schema, path/query parameters, and response schema for any operation ' +
  'of the other unifi_* tools. Call this before create/update/action operations. ' +
  'Input: { operation: "<tool>.<operation>" }, e.g. { operation: "unifi_networks.create" }.';

export const SPEC_TOOL_INPUT_SCHEMA = {
  type: 'object',
  properties: {
    operation: {
      type: 'string',
      description: 'Tool and operation joined by a dot, e.g. "unifi_firewall_policies.create".',
    },
  },
  required: ['operation'],
  additionalProperties: false,
} as const;

export function describeOperation(args: unknown): unknown {
  const parsed = specInput.safeParse(args);
  if (!parsed.success) {
    throw new UnifiUsageError(
      parsed.error.issues.map((i) => i.message).join('; ') || 'Invalid input for unifi_spec',
    );
  }
  const [toolName, opName] = parsed.data.operation.split('.') as [string, string];
  const map = loadOpMap();
  const tool = map.tools[toolName];
  if (!tool) {
    throw new UnifiUsageError(
      `Unknown tool "${toolName}". Tools: ${Object.keys(map.tools).join(', ')}`,
    );
  }
  const op = tool.ops[opName];
  if (!op) {
    throw new UnifiUsageError(
      `Unknown operation "${opName}" for ${toolName}. Valid operations: ${Object.keys(tool.ops).join(', ')}`,
    );
  }
  return {
    operation: parsed.data.operation,
    class: op.class,
    method: op.method,
    path: op.path,
    summary: op.summary,
    apiVersion: map.apiVersion,
    pathParams: op.pathParams,
    queryParams: op.queryParams,
    bodyRequired: op.bodyRequired,
    bodySchema: op.bodySchema === null ? null : deref(op.bodySchema),
    responseSchema: op.responseSchema === null ? null : deref(op.responseSchema),
  };
}
