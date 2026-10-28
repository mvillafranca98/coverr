import { readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { EXPECTED_MIGRATION, runProbe } from "../src/lib/health";

/**
 * The health endpoint is only worth having if it goes red for the right
 * reasons and only those. A probe that throws past the route turns a down
 * dependency into a crash page instead of a 503 naming it; a probe that hangs
 * with no deadline turns it into a bare monitor timeout.
 */

const never = () => new Promise<"ok">(() => {});

describe("one probe", () => {
  it("passes through a healthy answer", async () => {
    expect(await runProbe(async () => "ok")).toEqual({ state: "ok" });
  });

  it("passes through a database that is up but behind the code", async () => {
    expect(await runProbe(async () => "behind")).toEqual({ state: "behind" });
  });

  it("reports a dependency that throws as down, keeping the error for the log", async () => {
    const failure = new Error("D1_ERROR: network connection lost");
    const result = await runProbe(async () => {
      throw failure;
    });
    expect(result).toEqual({ state: "down", error: failure });
  });

  it("reports a dependency that never answers as timed out", async () => {
    expect(await runProbe(never, 20)).toEqual({ state: "timeout" });
  });

  // An answer that lands after the deadline must not flip the result, and its
  // rejection must not surface as an unhandled one and take the isolate down.
  it("stays timed out when a late answer fails", async () => {
    const late = () =>
      new Promise<"ok">((_, reject) => setTimeout(() => reject(new Error("late")), 40));
    expect(await runProbe(late, 10)).toEqual({ state: "timeout" });
    await new Promise((resolve) => setTimeout(resolve, 60));
  });
});

describe("the migration the build expects", () => {
  // The check compares production against drizzle-kit's journal. A migration
  // written by hand and never added to the journal would be invisible to it:
  // the deploy would ship code that needs it and the endpoint would stay green.
  it("is the newest migration file in the repo", () => {
    const files = readdirSync("migrations")
      .filter((name) => name.endsWith(".sql"))
      .sort();
    expect(EXPECTED_MIGRATION).toBe(files.at(-1));
  });

  it("is named the way wrangler records it", () => {
    expect(EXPECTED_MIGRATION).toMatch(/^\d{4}_[a-z0-9_]+\.sql$/);
  });
});
