import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // tests/unit        — pure logic, every external call mocked
    // tests/integration — lib/db.ts against a real in-process Postgres (PGlite)
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json'],
      include: ['lib/**/*.ts'],
      exclude: [
        'lib/cloudinary.ts', // thin wrapper over one HTTP call
        'lib/image-resize.ts', // browser-only (canvas)
        'lib/nutrition/reference-data.ts', // generated data
        '**/*.d.ts',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
})
