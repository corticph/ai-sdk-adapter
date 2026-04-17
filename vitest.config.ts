import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    setupFiles: ['./vitest.setup.ts'],
    testTimeout: 60000, // 60 seconds for integration tests
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        '**/__fixtures__/**',
        '**/__tests__/**',
        '**/__integration__/**',
        '**/node_modules/**',
        '**/dist/**',
      ],
    },
  },
});
