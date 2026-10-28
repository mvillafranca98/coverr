import { describe, expect, it } from "vitest";
import { FLAG_DEFAULTS, resolveFlags } from "../src/lib/flags";

/**
 * The switches that can be thrown without a deploy. What matters here is which
 * way each one points when nobody has touched it, because that is the state
 * production is in almost all of the time.
 */

describe("an empty table", () => {
  it("is the normal state and needs no rows", () => {
    expect(resolveFlags([])).toEqual(FLAG_DEFAULTS);
  });

  // The whole point of a kill switch is that stopping is deliberate. A store
  // that halts sales by being empty or unreachable would be worse than the
  // problem it exists to solve.
  it("leaves both kill switches on", () => {
    const flags = resolveFlags([]);
    expect(flags.sales).toBe(true);
    expect(flags.proof_extraction).toBe(true);
  });

  it("leaves billing off, which is the deliberate state today", () => {
    expect(resolveFlags([]).billing).toBe(false);
  });
});

describe("stored rows", () => {
  it("turns sales off", () => {
    expect(resolveFlags([{ key: "sales", enabled: 0 }]).sales).toBe(false);
  });

  it("turns billing on", () => {
    expect(resolveFlags([{ key: "billing", enabled: 1 }]).billing).toBe(true);
  });

  it("changes nothing it was not asked to change", () => {
    const flags = resolveFlags([{ key: "proof_extraction", enabled: 0 }]);
    expect(flags.proof_extraction).toBe(false);
    expect(flags.sales).toBe(true);
    expect(flags.billing).toBe(false);
  });

  it("reads an explicit 1 as on, so a row can restore a default", () => {
    expect(resolveFlags([{ key: "sales", enabled: 1 }]).sales).toBe(true);
  });

  // These get set by hand with a d1 execute, so the value will not always be
  // a tidy 0 or 1.
  it("treats any non-zero as on", () => {
    expect(resolveFlags([{ key: "billing", enabled: 2 }]).billing).toBe(true);
    expect(resolveFlags([{ key: "billing", enabled: -1 }]).billing).toBe(true);
  });
});

describe("rows that should not break a request", () => {
  it("ignores a key it does not know", () => {
    expect(resolveFlags([{ key: "left_over_switch", enabled: 0 }])).toEqual(FLAG_DEFAULTS);
  });

  it("cannot be tricked into writing onto the prototype", () => {
    const flags = resolveFlags([
      { key: "__proto__", enabled: 0 },
      { key: "constructor", enabled: 0 },
    ]);
    expect(flags).toEqual(FLAG_DEFAULTS);
  });

  it("lets the last row win when a key appears twice", () => {
    expect(
      resolveFlags([
        { key: "sales", enabled: 0 },
        { key: "sales", enabled: 1 },
      ]).sales,
    ).toBe(true);
  });

  it("returns a fresh object, so one request cannot alter the next", () => {
    const flags = resolveFlags([{ key: "sales", enabled: 0 }]);
    expect(flags.sales).toBe(false);
    expect(FLAG_DEFAULTS.sales).toBe(true);
  });
});
