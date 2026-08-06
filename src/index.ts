#!/usr/bin/env node
/**
 * Thin bin: argument parsing and delegation only. All behaviour lives in
 * buildServer() so it is testable in-process (RFC-004 D3).
 */
import { buildServer, listTools, PACKAGE_VERSION, SERVER_NAME } from './server.js';
import { loadConfig } from './api/config.js';
import { startStdio } from './transport/stdio.js';

const EX_CONFIG = 78; // BSD sysexits: configuration error

function main(): void {
  const arg = process.argv[2];
  switch (arg) {
    case '--version': {
      process.stdout.write(`${SERVER_NAME} ${PACKAGE_VERSION}\n`);
      return;
    }
    case '--list-tools': {
      for (const tool of listTools()) {
        process.stdout.write(`${tool.name}\n`);
      }
      return;
    }
    case '--check': {
      try {
        const { warnings } = loadConfig(process.env);
        for (const w of warnings) process.stderr.write(`WARNING: ${w}\n`);
        process.stdout.write('configuration ok\n');
        return;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        process.stderr.write(`${message}\n`);
        process.exitCode = EX_CONFIG;
        return;
      }
    }
    case undefined: {
      void startStdio(buildServer()).catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        process.stderr.write(`fatal: ${message}\n`);
        process.exitCode = 1;
      });
      return;
    }
    default: {
      process.stderr.write(
        `Unknown argument "${arg}". Usage: unifi-network-mcp [--version|--check|--list-tools]\n`,
      );
      process.exitCode = 64; // EX_USAGE
    }
  }
}

main();
