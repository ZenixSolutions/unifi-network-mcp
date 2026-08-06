import { z } from 'zod';
import { UnifiUsageError } from '../domain/types.js';

export const CONSOLES_TOOL_NAME = 'unifi_consoles';

export const CONSOLES_TOOL_DESCRIPTION =
  'List every UniFi console (company/site deployment) visible to the configured API key, ' +
  'via the Site Manager API (discovery only — ADR-002). Operations:\n' +
  '- list (Read): List consoles; returns id, name, type, ipAddress. ' +
  'Pass a returned id as consoleId to the other unifi_* tools in cloud mode.\n' +
  'Set refresh: true to bypass the per-process cache.';

export const CONSOLES_TOOL_INPUT_SCHEMA = {
  type: 'object',
  properties: {
    operation: { type: 'string', enum: ['list'], description: 'Which operation to perform.' },
    refresh: { type: 'boolean', description: 'Bypass the cached console list.' },
  },
  required: ['operation'],
  additionalProperties: false,
} as const;

const consolesInput = z
  .object({
    operation: z.literal('list'),
    refresh: z.boolean().optional(),
  })
  .strict();

export function parseConsolesInput(args: unknown): { refresh: boolean } {
  const parsed = consolesInput.safeParse(args);
  if (!parsed.success) {
    const details = parsed.error.issues
      .slice(0, 4)
      .map((i) => `${i.path.join('.') || '(input)'}: ${i.message}`)
      .join('; ');
    throw new UnifiUsageError(`Invalid input for ${CONSOLES_TOOL_NAME}: ${details}`);
  }
  return { refresh: parsed.data.refresh ?? false };
}
