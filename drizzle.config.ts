import type { Config } from "drizzle-kit";

// `generate` only reads the schema and emits SQL into ./migrations.
// Wrangler applies them; drizzle-kit never needs DB credentials.
export default {
  schema: "./src/db/schema.ts",
  out: "./migrations",
  dialect: "sqlite",
} satisfies Config;
