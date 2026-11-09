import { describe, expect, it } from "vitest";
import { decideCheckIns, settleLostClaims, type TicketState } from "../src/lib/check-in";

/**
 * What each scan in a door sync means. A sync carries every scan a device
 * queued, often hundreds made offline, and is read and written in a handful
 * of queries (security review S11); these are the rules it applies.
 */

const outside = (id: string): TicketState => ({
  id,
  checkedInAt: null,
  checkedInDevice: null,
  voidedAt: null,
  orderStatus: "confirmed",
});

const scan = (t: string, at = "2026-11-20T21:10:00-06:00", device: string | null = "dev-a") => ({
  t,
  at,
  device,
});

describe("decideCheckIns", () => {
  it("lets in a ticket that is outside, and claims it for writing", () => {
    const { results, claims } = decideCheckIns([scan("T1")], new Map([["T1", outside("att_1")]]));
    expect(results).toEqual([{ t: "T1", status: "ok" }]);
    expect(claims.get("T1")).toEqual({
      attendeeId: "att_1",
      at: "2026-11-20T21:10:00-06:00",
      device: "dev-a",
    });
  });

  it("calls a token from nowhere unknown", () => {
    const { results, claims } = decideCheckIns([scan("NOPE")], new Map());
    expect(results).toEqual([{ t: "NOPE", status: "unknown" }]);
    expect(claims.size).toBe(0);
  });

  it("refuses a refunded order and a ticket voided on its own", () => {
    const tickets = new Map([
      ["T1", { ...outside("att_1"), orderStatus: "refunded" }],
      ["T2", { ...outside("att_2"), voidedAt: "2026-11-19T10:00:00Z" }],
    ]);
    const { results, claims } = decideCheckIns([scan("T1"), scan("T2")], tickets);
    expect(results.map((r) => r.status)).toEqual(["voided", "voided"]);
    expect(claims.size).toBe(0);
  });

  it("names who let a ticket in when it is already inside", () => {
    const tickets = new Map([
      [
        "T1",
        { ...outside("att_1"), checkedInAt: "2026-11-20T21:04:00-06:00", checkedInDevice: "dev-b" },
      ],
    ]);
    expect(decideCheckIns([scan("T1")], tickets).results).toEqual([
      { t: "T1", status: "already", at: "2026-11-20T21:04:00-06:00", by: "dev-b" },
    ]);
  });

  it("treats a second scan of one ticket in the same sync as a double scan", () => {
    const { results, claims } = decideCheckIns(
      [scan("T1", "2026-11-20T21:10:00-06:00"), scan("T1", "2026-11-20T21:30:00-06:00")],
      new Map([["T1", outside("att_1")]]),
    );
    expect(results).toEqual([
      { t: "T1", status: "ok" },
      { t: "T1", status: "already", at: "2026-11-20T21:10:00-06:00", by: "dev-a" },
    ]);
    expect(claims.size).toBe(1);
  });

  it("answers every scan, in the order the device made them", () => {
    const { results } = decideCheckIns(
      [scan("T2"), scan("NOPE"), scan("T1")],
      new Map([
        ["T1", outside("att_1")],
        ["T2", outside("att_2")],
      ]),
    );
    expect(results.map((r) => r.t)).toEqual(["T2", "NOPE", "T1"]);
  });
});

describe("settleLostClaims", () => {
  // Another device's sync wrote the ticket between this one's read and write.
  it("turns every scan of a ticket another device won into a double scan", () => {
    const decided = decideCheckIns(
      [scan("T1"), scan("T2"), scan("T1")],
      new Map([
        ["T1", outside("att_1")],
        ["T2", outside("att_2")],
      ]),
    );
    const winners = new Map([
      [
        "T1",
        { ...outside("att_1"), checkedInAt: "2026-11-20T21:09:00-06:00", checkedInDevice: "dev-b" },
      ],
    ]);
    expect(settleLostClaims(decided.results, winners)).toEqual([
      { t: "T1", status: "already", at: "2026-11-20T21:09:00-06:00", by: "dev-b" },
      { t: "T2", status: "ok" },
      { t: "T1", status: "already", at: "2026-11-20T21:09:00-06:00", by: "dev-b" },
    ]);
  });
});
