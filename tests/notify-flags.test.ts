import { describe, expect, it } from "vitest";
import { ALERT_CAP_PER_EVENT, shouldAlert } from "../src/jobs/notify-flags";

/**
 * When a band is worth interrupting.
 *
 * The policy is separated from the queries precisely so it can be checked
 * here: getting it wrong in either direction is costly. Too quiet and a
 * recycled proof goes unnoticed; too loud and the band filters the sender,
 * which costs them the alert that mattered.
 */

const critical = [{ severity: "critical" }];
const warning = [{ severity: "warning" }];
const info = [{ severity: "info" }];

describe("severity", () => {
  it("alerts on a critical flag", () => {
    expect(shouldAlert({ flags: critical, alreadyFlaggedOrders: 1 })).toBe(true);
  });

  // A short payment is for the band to look at, not to be woken by.
  it("stays quiet for a warning", () => {
    expect(shouldAlert({ flags: warning, alreadyFlaggedOrders: 1 })).toBe(false);
  });

  // NAME_MISMATCH is info and fires on ordinary group purchases. Emailing
  // about those is how a band learns to ignore the sender.
  it("stays quiet for info", () => {
    expect(shouldAlert({ flags: info, alreadyFlaggedOrders: 1 })).toBe(false);
  });

  it("stays quiet when nothing fired", () => {
    expect(shouldAlert({ flags: [], alreadyFlaggedOrders: 0 })).toBe(false);
  });

  it("alerts when a critical rides along with lesser flags", () => {
    expect(
      shouldAlert({
        flags: [...info, ...warning, ...critical],
        alreadyFlaggedOrders: 1,
      }),
    ).toBe(true);
  });
});

describe("the per-event cap", () => {
  it("alerts up to and including the cap", () => {
    expect(shouldAlert({ flags: critical, alreadyFlaggedOrders: ALERT_CAP_PER_EVENT })).toBe(true);
  });

  // Past the cap the band has a problem no email can convey, and the flags
  // are all still in the dashboard.
  it("goes quiet past the cap", () => {
    expect(shouldAlert({ flags: critical, alreadyFlaggedOrders: ALERT_CAP_PER_EVENT + 1 })).toBe(
      false,
    );
  });

  it("does not alert past the cap even for a critical flag", () => {
    expect(shouldAlert({ flags: critical, alreadyFlaggedOrders: 300 })).toBe(false);
  });

  it("caps per event rather than per order", () => {
    // The count passed in is orders already flagged in the whole event, which
    // is what stops a bad batch becoming a mailbox full of identical alerts.
    expect(ALERT_CAP_PER_EVENT).toBeGreaterThan(0);
    expect(ALERT_CAP_PER_EVENT).toBeLessThan(50);
  });
});
