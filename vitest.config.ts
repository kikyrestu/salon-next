import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './vitest.setup.ts',
    include: ['__tests__/**/*.test.ts', '__tests__/**/*.test.tsx', '**/*.test.ts', '**/*.test.tsx'],
    exclude: ['node_modules', '.next', 'dist'],
    testTimeout: 15000,
    alias: {
      '@': path.resolve(__dirname, './'),
    },
    coverage: {
      provider: 'istanbul',
      include: ['lib/**/*.ts', 'hooks/**/*.ts'],
      exclude: ['lib/mongodb.ts', 'lib/masterDb.ts', 'lib/tenantDb.ts', 'lib/initModels.ts'],
      reporter: ['text', 'text-summary'],
    },
  },
});
