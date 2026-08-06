import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PACKAGE_VERSION } from '../src/server.js';

describe('version', () => {
  it('PACKAGE_VERSION matches package.json', () => {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
      version: string;
    };
    expect(PACKAGE_VERSION).toBe(pkg.version);
  });
});
