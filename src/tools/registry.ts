import { readFileSync } from 'node:fs';
import { z } from 'zod';
import type { JsonSchema, OpMap, OperationDef, ToolDef } from '../domain/types.js';
import { GATED_CLASSES, UnifiUsageError } from '../domain/types.js';

let cachedMap: OpMap | undefined;

export function loadOpMap(): OpMap {
  cachedMap ??= JSON.parse(
    readFileSync(new URL('../generated/op-map.json', import.meta.url), 'utf8'),
  ) as OpMap;
  return cachedMap;
}

const CLASS_LABEL: Record<OperationDef['class'], string> = {
  read: 'Read',
  create: 'Create',
  update: 'Update',
  admin: 'Admin',
  destructive: 'Destructive',
};

const FILTER_HINT =
  'Filtering: pass filter as property.function(args); combine with and(...), or(...), not(...). ' +
  "Functions: eq, ne, gt, ge, lt, le, like, in, notIn, isNull, isNotNull; SET: contains, containsAny, containsAll, containsExactly, isEmpty. Strings use single quotes ('guest'); like patterns: '.'=one char, '*'=any run, '\\'=escape.";

const PAGINATION_HINT =
  'List results are pages: { offset, limit (max 200), count, totalCount, data[] }.';

/** MCP tool description assembled from the generated op map. */
export function buildToolDescription(name: string, tool: ToolDef): string {
  const lines = Object.entries(tool.ops).map(([opName, op]) => {
    const gate = GATED_CLASSES.includes(op.class) ? ' — requires confirm: true' : '';
    return `- ${opName} (${CLASS_LABEL[op.class]}): ${op.summary}${gate}`;
  });
  const hasFilter = Object.values(tool.ops).some((op) =>
    op.queryParams.some((q) => q.name === 'filter'),
  );
  const hasList = Object.values(tool.ops).some((op) =>
    op.queryParams.some((q) => q.name === 'offset'),
  );
  const hasBody = Object.values(tool.ops).some((op) => op.bodySchema !== null);
  const extras = [
    hasList ? PAGINATION_HINT : null,
    hasFilter ? FILTER_HINT : null,
    hasBody
      ? `For request-body shapes call unifi_spec with { operation: "${name}.<operation>" }.`
      : null,
  ].filter((x): x is string => x !== null);
  return [`${tool.title}. Operations:`, ...lines, ...extras].join('\n');
}

/** JSON Schema shown to the model for a grouped tool. */
export function buildToolInputSchema(tool: ToolDef): Record<string, unknown> {
  const opNames = Object.keys(tool.ops);
  const properties: Record<string, unknown> = {
    operation: { type: 'string', enum: opNames, description: 'Which operation to perform.' },
  };
  const usedBy = (predicate: (op: OperationDef) => boolean): string =>
    Object.entries(tool.ops)
      .filter(([, op]) => predicate(op))
      .map(([n]) => n)
      .join(', ');

  const paramNames = new Set<string>();
  for (const op of Object.values(tool.ops)) {
    for (const p of op.pathParams) paramNames.add(p.name);
    for (const q of op.queryParams) paramNames.add(q.name);
  }
  for (const name of paramNames) {
    const inOps = usedBy(
      (op) =>
        op.pathParams.some((p) => p.name === name) || op.queryParams.some((q) => q.name === name),
    );
    const sample =
      Object.values(tool.ops)
        .flatMap((op) => [...op.pathParams, ...op.queryParams])
        .find((p) => p.name === name)?.schema ?? {};
    const type = sample['type'] === 'integer' ? 'integer' : 'string';
    properties[name] = {
      type,
      description: `${describeParam(name, sample)} Used by: ${inOps}.`,
    };
  }
  const gatedOps = usedBy((op) => GATED_CLASSES.includes(op.class));
  if (gatedOps.length > 0) {
    properties['confirm'] = {
      type: 'boolean',
      description: `Must be true to execute: ${gatedOps}. These change or remove live configuration.`,
    };
  }
  const bodyOps = usedBy((op) => op.bodySchema !== null);
  if (bodyOps.length > 0) {
    properties['body'] = {
      type: 'object',
      additionalProperties: true,
      description: `Request body for: ${bodyOps}. Exact schema via unifi_spec.`,
    };
  }
  return {
    type: 'object',
    properties,
    required: ['operation'],
    additionalProperties: false,
  };
}

function describeParam(name: string, schema: JsonSchema): string {
  if (name === 'offset') return 'Pagination offset (default 0).';
  if (name === 'limit') return 'Page size (default 25, max 200).';
  if (name === 'filter') return 'Filter expression (see tool description).';
  const format = typeof schema['format'] === 'string' ? ` (${schema['format']})` : '';
  return `${name}${format}.`;
}

/** Runtime Zod envelope for one operation — strict, per RFC-004 D1. */
export function buildEnvelopeSchema(opName: string, op: OperationDef): z.ZodTypeAny {
  const shape: Record<string, z.ZodTypeAny> = {
    operation: z.literal(opName),
  };
  for (const p of op.pathParams) {
    shape[p.name] =
      p.schema['type'] === 'integer'
        ? z.number().int()
        : z.string().min(1, `${p.name} must be a non-empty string`);
  }
  for (const q of op.queryParams) {
    let s: z.ZodTypeAny;
    if (q.name === 'offset') s = z.number().int().min(0);
    else if (q.name === 'limit') s = z.number().int().min(0).max(200);
    else if (q.schema['type'] === 'integer') s = z.number().int();
    else s = z.string();
    shape[q.name] = q.required ? s : s.optional();
  }
  const gated = GATED_CLASSES.includes(op.class);
  if (gated) {
    shape['confirm'] = z.literal(true, {
      errorMap: () => ({
        message: `"${opName}" is a ${CLASS_LABEL[op.class]} operation (${op.method} ${op.path}). Pass confirm: true to proceed.`,
      }),
    });
  } else {
    shape['confirm'] = z.boolean().optional();
  }
  if (op.bodySchema !== null) {
    const body = z.record(z.unknown());
    shape['body'] = op.bodyRequired ? body : body.optional();
  }
  return z.object(shape).strict();
}

export interface ResolvedCall {
  readonly op: OperationDef;
  readonly pathParams: Record<string, string | number>;
  readonly queryParams: Record<string, string | number | undefined>;
  readonly body: unknown;
}

/** Validates a raw tool call against the op map; throws UnifiUsageError on any mismatch. */
export function resolveCall(toolName: string, args: unknown): ResolvedCall {
  const map = loadOpMap();
  const tool = map.tools[toolName];
  if (!tool) throw new UnifiUsageError(`Unknown tool "${toolName}"`);
  const rawOperation =
    typeof args === 'object' && args !== null && 'operation' in args
      ? (args as { operation: unknown }).operation
      : undefined;
  if (typeof rawOperation !== 'string' || !(rawOperation in tool.ops)) {
    throw new UnifiUsageError(
      `Unknown operation ${JSON.stringify(rawOperation)} for ${toolName}. Valid operations: ${Object.keys(tool.ops).join(', ')}`,
    );
  }
  const op = tool.ops[rawOperation];
  if (!op) throw new UnifiUsageError(`Unknown operation "${rawOperation}"`);
  const parsed = buildEnvelopeSchema(rawOperation, op).safeParse(args);
  if (!parsed.success) {
    const details = parsed.error.issues
      .slice(0, 8)
      .map((i) => `${i.path.join('.') || '(input)'}: ${i.message}`)
      .join('; ');
    throw new UnifiUsageError(`Invalid input for ${toolName}.${rawOperation}: ${details}`);
  }
  const data = parsed.data as Record<string, unknown>;
  const pathParams: Record<string, string | number> = {};
  for (const p of op.pathParams) pathParams[p.name] = data[p.name] as string | number;
  const queryParams: Record<string, string | number | undefined> = {};
  for (const q of op.queryParams) {
    queryParams[q.name] = data[q.name] as string | number | undefined;
  }
  return { op, pathParams, queryParams, body: data['body'] };
}
