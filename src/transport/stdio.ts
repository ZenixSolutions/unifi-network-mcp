import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { BuiltServer } from '../server.js';

/** Connects the built server to stdio. Warnings go to stderr — stdout is the protocol channel. */
export async function startStdio(built: BuiltServer): Promise<void> {
  for (const warning of built.warnings) {
    process.stderr.write(`[unifi-network-mcp] WARNING: ${warning}\n`);
  }
  const transport = new StdioServerTransport();
  await built.server.connect(transport);
}
