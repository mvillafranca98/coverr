import { describe, expect, it } from "vitest";
import { isRecord, parseJsonObject } from "../src/lib/json";
import { MAX_SCANS_PER_SYNC, readCashSale, readCheckinBatch } from "../src/lib/scan-request";

/**
 * The scanner API only ever hears from public/scanner.js, which always sends
 * well-formed JSON. Anything else must be refused or cleaned up before it
 * reaches an insert, where it would crash and page the operator for nothing.
 */

const NOW = "2026-10-28T23:40:00.000Z";

describe("reading a JSON body", () => {
  it("reads an object", () => {
    expect(parseJsonObject('{"scans":[]}')).toEqual({ scans: [] });
  });

  // Each of these parses, and each would crash `body.scans`.
  it("refuses JSON that is not an object", () => {
    for (const raw of ["null", "42", '"text"', "[]", "true"]) {
      expect(parseJsonObject(raw)).toBeNull();
    }
  });

  it("refuses text that is not JSON", () => {
    expect(parseJsonObject("{not json")).toBeNull();
    expect(parseJsonObject("")).toBeNull();
  });

  it("tells an object from an array and from null", () => {
    expect(isRecord({})).toBe(true);
    expect(isRecord([])).toBe(false);
    expect(isRecord(null)).toBe(false);
  });
});

describe("a check-in sync", () => {
  it("keeps the device's own scan time and name", () => {
    const scans = readCheckinBatch(
      { scans: [{ t: "QR1", at: "2026-10-28T21:10:00.000Z", device: "dev-a1b2c" }] },
      NOW,
    );
    expect(scans).toEqual([{ t: "QR1", at: "2026-10-28T21:10:00.000Z", device: "dev-a1b2c" }]);
  });

  // A scan queued offline at 21:10 and synced at 23:40 happened at 21:10, but
  // a time that cannot be read must not fail the batch or reach the database.
  it("falls back to the arrival time when the device time is unusable", () => {
    const scans = readCheckinBatch(
      { scans: [{ t: "QR1", at: { when: "now" } }, { t: "QR2", at: "pronto" }, { t: "QR3" }] },
      NOW,
    );
    expect(scans.map((s) => s.at)).toEqual([NOW, NOW, NOW]);
  });

  it("drops entries with no ticket token", () => {
    const scans = readCheckinBatch(
      { scans: [null, 7, { at: NOW }, { t: 42 }, { t: "" }, { t: "QR9" }] },
      NOW,
    );
    expect(scans.map((s) => s.t)).toEqual(["QR9"]);
  });

  it("stores no device rather than an object or a novel", () => {
    const scans = readCheckinBatch(
      {
        scans: [
          { t: "QR1", device: { id: 1 } },
          { t: "QR2", device: "x".repeat(500) },
        ],
      },
      NOW,
    );
    expect(scans[0]?.device).toBeNull();
    expect(scans[1]?.device).toHaveLength(40);
  });

  it("reads nothing from a body without a list of scans", () => {
    expect(readCheckinBatch({ scans: "QR1" }, NOW)).toEqual([]);
    expect(readCheckinBatch({}, NOW)).toEqual([]);
  });

  it("takes at most one sync's worth of scans", () => {
    const scans = Array.from({ length: MAX_SCANS_PER_SYNC + 50 }, (_, i) => ({ t: `QR${i}` }));
    expect(readCheckinBatch({ scans }, NOW)).toHaveLength(MAX_SCANS_PER_SYNC);
  });
});

describe("a cash sale or comp", () => {
  it("reads a sale", () => {
    expect(readCashSale({ quantity: 3, comp: false, device: "dev-a1b2c" })).toEqual({
      quantity: 3,
      comp: false,
      device: "dev-a1b2c",
    });
  });

  it("clamps the quantity to what the door stepper allows", () => {
    expect(readCashSale({ quantity: 0 }).quantity).toBe(1);
    expect(readCashSale({ quantity: 500 }).quantity).toBe(20);
    expect(readCashSale({ quantity: "lots" }).quantity).toBe(1);
  });

  // A comp contributes nothing to revenue, so it must be asked for exactly.
  it("is only a comp when comp is literally true", () => {
    expect(readCashSale({ comp: "true" }).comp).toBe(false);
    expect(readCashSale({ comp: 1 }).comp).toBe(false);
    expect(readCashSale({ comp: true }).comp).toBe(true);
  });
});
