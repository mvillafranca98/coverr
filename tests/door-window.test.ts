import { describe, expect, it } from "vitest";
import { DOOR_OPEN_HOURS, doorAccess, LATE_SYNC_DAYS } from "../src/lib/door-window";

/**
 * A door link stops working after its event: the list, cash sales and stats a
 * day after the start, late check-in syncs a week after (security review S4).
 */

const START = "2026-11-20T21:00:00-06:00";
const hoursAfter = (hours: number) => new Date(Date.parse(START) + hours * 3_600_000);

describe("doorAccess", () => {
  it("is open before the show, so staff can load the list early", () => {
    expect(doorAccess(START, hoursAfter(-72))).toBe("open");
  });

  it("stays open through the night and until a day after the start", () => {
    expect(doorAccess(START, hoursAfter(6))).toBe("open");
    expect(doorAccess(START, hoursAfter(DOOR_OPEN_HOURS))).toBe("open");
  });

  it("then only takes the check-ins a device queued offline", () => {
    expect(doorAccess(START, hoursAfter(DOOR_OPEN_HOURS + 1))).toBe("sync-only");
    expect(doorAccess(START, hoursAfter(LATE_SYNC_DAYS * 24))).toBe("sync-only");
  });

  it("closes for good a week after the start", () => {
    expect(doorAccess(START, hoursAfter(LATE_SYNC_DAYS * 24 + 1))).toBe("closed");
    expect(doorAccess(START, hoursAfter(24 * 60))).toBe("closed");
  });

  it("goes by the start time, so a postponed event reopens its link", () => {
    const later = "2026-12-20T21:00:00-06:00";
    expect(doorAccess(later, hoursAfter(24 * 10))).toBe("open");
  });

  // A bad date must never be what locks staff out on the night.
  it("stays open when the start time cannot be read", () => {
    expect(doorAccess("not a date", hoursAfter(24 * 365))).toBe("open");
  });
});
