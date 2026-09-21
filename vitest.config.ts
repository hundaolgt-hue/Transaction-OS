import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      // The server-only guard is a build-time marker; under vitest it would throw.
      'server-only': path.resolve(__dirname, 'tests/stubs/server-only.ts'),
    },
  },
  test: { environment: 'node', include: ['tests/**/*.test.ts'], pool: 'forks' },
});
