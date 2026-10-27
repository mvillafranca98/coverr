import { defineConfig } from "vitest/config";

/**
 * Covers `src/lib` only, deliberately.
 *
 * Everything there is a pure function: no database, no network, no Workers
 * runtime. That is also where the decisions live that cost money or turn
 * somebody away at a door — the eight verification rules, the settlement
 * split, the refund gate, centavo arithmetic. Those are worth locking down,
 * and they run in milliseconds.
 *
 * Routes and views are not covered here. They need a Workers runtime and a
 * database, which is a different kind of test and a different kind of slow.
 */
export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    coverage: {
      include: ["src/lib/**/*.ts"],
      exclude: ["src/lib/extract.ts", "src/lib/email.ts", "src/lib/png.ts", "src/lib/qr.ts"],
    },
  },
});
