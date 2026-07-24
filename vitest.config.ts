import {defineConfig} from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    clearMocks: true,
    testTimeout: 60000,
    // generates specs share the tmp/ dir and each lints the whole tree, so run files
    // sequentially to avoid a rm-during-lint race (ENOENT) as more specs are added.
    fileParallelism: false,
    include: ['src/**/*.{test,spec}.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.d.ts', 'src/**/__tests__/**', 'src/**/*.{test,spec}.ts'],
    },
  },
});
