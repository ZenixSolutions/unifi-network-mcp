import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    exclude:
      process.env['UNIFI_CONTRACT'] === '1'
        ? [...configDefaults.exclude]
        : [...configDefaults.exclude, 'tests/contract/**'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/transport/**', 'src/index.ts', 'src/generated/**'],
      thresholds: {
        lines: 85,
        functions: 85,
        branches: 85,
        statements: 85,
      },
    },
  },
});
