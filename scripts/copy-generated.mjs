#!/usr/bin/env node
/** Copies committed generated JSON artifacts into dist/ after tsc. */
import { cpSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
mkdirSync(join(root, 'dist/generated'), { recursive: true });
for (const f of ['op-map.json', 'spec-schemas.json']) {
  cpSync(join(root, 'src/generated', f), join(root, 'dist/generated', f));
}
console.log('copied generated artifacts to dist/generated');
