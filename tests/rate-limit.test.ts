import type { Context } from "hono";
import { describe, expect, it } from "vitest";
import { type Limiter, withinLimit, withinMailLimit } from "../src/lib/rate-limit";

/**
 * Every form that sends an email is limited per caller and per inbox. The
 * per-inbox half is what stops someone with several connections from keeping
 * one band's or one buyer's inbox filling (security review S5).
 */

/** A limiter that allows `perKey` calls for each key and remembers every key it saw. */
function countingLimiter(perKey: number): Limiter & { keys: string[] } {
  const seen = new Map<string, number>();
  const keys: string[] = [];
  return {
    keys,
    async limit({ key }) {
      keys.push(key);
      const count = (seen.get(key) ?? 0) + 1;
      seen.set(key, count);
      return { success: count <= perKey };
    },
  };
}

const from = (ip: string) => ({ req: { header: () => ip } }) as unknown as Context;

describe("withinMailLimit", () => {
  it("lets a caller mail an inbox while both are under the limit", async () => {
    const limiter = countingLimiter(2);
    expect(await withinMailLimit(limiter, from("1.1.1.1"), "ana@ejemplo.com")).toBe(true);
    expect(await withinMailLimit(limiter, from("1.1.1.1"), "ana@ejemplo.com")).toBe(true);
  });

  it("refuses one inbox from any number of callers once it is over", async () => {
    const limiter = countingLimiter(2);
    expect(await withinMailLimit(limiter, from("1.1.1.1"), "ana@ejemplo.com")).toBe(true);
    expect(await withinMailLimit(limiter, from("2.2.2.2"), "ana@ejemplo.com")).toBe(true);
    expect(await withinMailLimit(limiter, from("3.3.3.3"), "ana@ejemplo.com")).toBe(false);
    expect(await withinMailLimit(limiter, from("3.3.3.3"), "beto@ejemplo.com")).toBe(true);
  });

  it("refuses a caller over its own limit without spending the inbox's", async () => {
    const limiter = countingLimiter(1);
    expect(await withinMailLimit(limiter, from("1.1.1.1"), "ana@ejemplo.com")).toBe(true);
    expect(await withinMailLimit(limiter, from("1.1.1.1"), "carla@ejemplo.com")).toBe(false);
    // Carla's single allowance is still there for a caller who is not over.
    expect(await withinMailLimit(limiter, from("2.2.2.2"), "carla@ejemplo.com")).toBe(true);
  });

  // The limiter logs its key when it fails, so the address must not be in it.
  it("keys the inbox by a hash of the normalised address, never the address", async () => {
    const limiter = countingLimiter(5);
    await withinMailLimit(limiter, from("1.1.1.1"), " Ana@Ejemplo.com ");
    await withinMailLimit(limiter, from("2.2.2.2"), "ana@ejemplo.com");
    const inboxKeys = limiter.keys.filter((key) => key.startsWith("mail-to:"));
    expect(inboxKeys).toHaveLength(2);
    expect(inboxKeys[0]).toBe(inboxKeys[1]);
    expect(inboxKeys[0]).toMatch(/^mail-to:[0-9a-f]{64}$/);
    expect(limiter.keys.join(" ")).not.toContain("ejemplo");
  });

  it("lets mail through when there is no limiter, like every other limit", async () => {
    expect(await withinMailLimit(undefined, from("1.1.1.1"), "ana@ejemplo.com")).toBe(true);
    expect(await withinLimit(undefined, "anything")).toBe(true);
  });
});
