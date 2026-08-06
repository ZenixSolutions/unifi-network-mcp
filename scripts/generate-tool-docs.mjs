#!/usr/bin/env node
/** Generates docs/tools.md from src/generated/op-map.json. Committed; CI verifies freshness. */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const map = JSON.parse(readFileSync(join(root, 'src/generated/op-map.json'), 'utf8'));

const CLASS_LABEL = {
  read: 'Read',
  create: 'Create',
  update: 'Update',
  admin: 'Admin ⚠️',
  destructive: 'Destructive ⚠️',
};

let out = `# Tool reference

Generated from the committed vendor contract (UniFi Network API v${map.apiVersion}) — do not edit by hand; run \`npm run generate\`.

Every tool takes an \`operation\` argument. Operations marked ⚠️ require \`confirm: true\`.
For exact request-body shapes, call \`unifi_spec\` with \`{ "operation": "<tool>.<operation>" }\`.

`;

for (const [name, tool] of Object.entries(map.tools)) {
  out += `## \`${name}\`\n\n${tool.title}\n\n`;
  out += `| Operation | Class | API call | Summary |\n|---|---|---|---|\n`;
  for (const [opName, op] of Object.entries(tool.ops)) {
    const params = [
      ...op.pathParams.map((p) => p.name),
      ...op.queryParams.map((q) => (q.required ? q.name : `${q.name}?`)),
      ...(op.bodySchema ? [op.bodyRequired ? 'body' : 'body?'] : []),
    ].join(', ');
    out += `| \`${opName}\`${params ? ` (${params})` : ''} | ${CLASS_LABEL[op.class]} | \`${op.method} ${op.path}\` | ${op.summary} |\n`;
  }
  out += '\n';
}

out += `## \`unifi_spec\`

Vendor API contract lookup (Read). Input: \`{ "operation": "<tool>.<operation>" }\`. Returns the operation's method, path, class, parameters, request-body schema, and response schema, dereferenced from the committed OpenAPI contract.

## \`unifi_consoles\`

Console discovery for cloud mode (Read, ADR-002). \`{ "operation": "list" }\` returns every console visible to the API key via Site Manager \`GET /v1/hosts\` — pass a returned \`id\` as \`consoleId\` to any other tool. \`refresh: true\` bypasses the per-process cache.

## Cloud mode and \`consoleId\`

Every tool accepts an optional \`consoleId\` (cloud mode only; ignored in direct mode). With no \`consoleId\` in cloud mode: one visible console is used automatically; several visible consoles return the list to choose from.
`;

writeFileSync(join(root, 'docs/tools.md'), out);
console.log('generated docs/tools.md');
