#!/usr/bin/env node
/**
 * Measures the real tools/list cost through an actual MCP initialize +
 * tools/list handshake over stdio, and fails if it exceeds the RFC-004 D1
 * budget. Measured, not estimated (the NetBox lesson).
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const BUDGET_TOKENS = 25_000;
const CHARS_PER_TOKEN = 4; // conservative

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const child = spawn(process.execPath, [join(root, 'dist/index.js')], {
  stdio: ['pipe', 'pipe', 'inherit'],
  env: { ...process.env, UNIFI_CONSOLE_URL: 'https://127.0.0.1', UNIFI_API_KEY: 'budget-check' },
});

const send = (msg) => child.stdin.write(JSON.stringify(msg) + '\n');
let buffer = '';
const responses = [];

child.stdout.on('data', (chunk) => {
  buffer += chunk.toString();
  let idx;
  while ((idx = buffer.indexOf('\n')) >= 0) {
    const line = buffer.slice(0, idx);
    buffer = buffer.slice(idx + 1);
    if (line.trim()) responses.push(JSON.parse(line));
  }
});

send({
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2025-03-26',
    capabilities: {},
    clientInfo: { name: 'budget-check', version: '0.0.0' },
  },
});

setTimeout(() => {
  send({ jsonrpc: '2.0', method: 'notifications/initialized' });
  send({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
}, 300);

setTimeout(() => {
  child.kill();
  const listResponse = responses.find((r) => r.id === 2);
  if (!listResponse?.result?.tools) {
    console.error('tools/list handshake failed', JSON.stringify(responses).slice(0, 2000));
    process.exit(1);
  }
  const payload = JSON.stringify(listResponse.result);
  const chars = payload.length;
  const estTokens = Math.round(chars / CHARS_PER_TOKEN);
  const toolCount = listResponse.result.tools.length;
  console.log(
    `tools/list: ${toolCount} tools, ${chars} chars ≈ ${estTokens} tokens (budget ${BUDGET_TOKENS})`,
  );
  if (estTokens > BUDGET_TOKENS) {
    console.error(`BUDGET EXCEEDED by ${estTokens - BUDGET_TOKENS} tokens`);
    process.exit(1);
  }
}, 1500);
