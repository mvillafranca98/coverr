import { defineConfig } from "vitest/config";

/**
 * The end-to-end run: `npm run e2e`. A real browser drives a private local
 * Coverr (tests/e2e/server.ts) through one whole night. Kept apart from the
 * unit tests in vitest.config.ts because it needs a running server and takes
 * a minute, not milliseconds.
 */
export default defineConfig({
  test: {
    include: ["tests/e2e/**/*.e2e.ts"],
    environment: "node",
    globalSetup: ["tests/e2e/server.ts"],
    fileParallelism: false,
    testTimeout: 90_000,
    hookTimeout: 180_000,
  },
});
