import { describe, expect, it } from "vitest";
import { ALERT_WINDOW_MINUTES, alertClaimKey, errorFingerprint } from "../src/jobs/report-error";

/**
 * The two decisions that stand between a crash loop and a mailbox with three
 * hundred identical emails in it: what counts as the same bug, and which
 * window it belongs to.
 */

function fp(message: string, path: string | null = "/e/:slug/comprar"): string {
  return errorFingerprint({ kind: "request", path, message });
}

describe("errorFingerprint", () => {
  it("gives the same bug the same fingerprint", () => {
    expect(fp("D1_ERROR: no such column")).toBe(fp("D1_ERROR: no such column"));
  });

  // The whole point: ids are what differ between two reports of one bug.
  it("ignores the ids that differ between occurrences", () => {
    expect(fp("order ord_m2h8x1q4 not found")).toBe(fp("order ord_q4b7z9kk not found"));
  });

  it("ignores numbers, so a row count or a status does not split a bug", () => {
    expect(fp("expected 4 attendees, got 7")).toBe(fp("expected 9 attendees, got 2"));
  });

  it("ignores case and collapsed whitespace", () => {
    expect(fp("Cannot read   property\tx")).toBe(fp("cannot read property x"));
  });

  it("separates genuinely different failures", () => {
    expect(fp("no such column")).not.toBe(fp("network timeout"));
  });

  // Same message thrown from two handlers is two bugs to chase, not one.
  it("separates the same message raised on different routes", () => {
    expect(fp("no such column", "/e/:slug/comprar")).not.toBe(
      fp("no such column", "/admin/eventos"),
    );
  });

  it("separates a request failure from a cron failure", () => {
    expect(errorFingerprint({ kind: "request", path: null, message: "boom" })).not.toBe(
      errorFingerprint({ kind: "scheduled", path: null, message: "boom" }),
    );
  });

  // A stack trace arriving as the message would otherwise make the key useless.
  it("reads only the first line", () => {
    expect(fp("boom\n  at handler (index.js:1:1)")).toBe(fp("boom\n  at other (other.js:9:9)"));
  });

  it("stays bounded no matter how long the message is", () => {
    const key = fp("x".repeat(5000));
    expect(key.length).toBeLessThan(260);
  });

  it("handles an empty message without throwing", () => {
    expect(() => fp("")).not.toThrow();
  });
});

describe("alertClaimKey", () => {
  const start = Date.parse("2026-10-27T20:00:00Z");
  const minute = 60_000;

  it("is the same key for the same error in the same window", () => {
    expect(alertClaimKey({ nowMs: start, fingerprint: "a" })).toBe(
      alertClaimKey({ nowMs: start + 5 * minute, fingerprint: "a" }),
    );
  });

  it("changes once the window has passed", () => {
    expect(alertClaimKey({ nowMs: start, fingerprint: "a" })).not.toBe(
      alertClaimKey({ nowMs: start + ALERT_WINDOW_MINUTES * minute, fingerprint: "a" }),
    );
  });

  it("never collides between two different errors in one window", () => {
    expect(alertClaimKey({ nowMs: start, fingerprint: "a" })).not.toBe(
      alertClaimKey({ nowMs: start, fingerprint: "b" }),
    );
  });

  it("carries the fingerprint, so a claim can be read back", () => {
    expect(alertClaimKey({ nowMs: start, fingerprint: "request|/x|boom" })).toContain(
      "request|/x|boom",
    );
  });
});
