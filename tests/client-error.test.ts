import { describe, expect, it } from "vitest";
import {
  MAX_REPORTS_PER_BATCH,
  readClientErrorReports,
  redactTokens,
} from "../src/lib/client-error";

/**
 * Scanner reports end in an email. The staff link opens the scanner and a QR
 * token gets somebody through the door, so neither may survive into one —
 * and the camera errors that are the whole point of reporting must.
 */

const STAFF = "7K2M9QXH4RT8VB3NWC";
const QR = "4D9X7K2M0QH8RT3VBN6WCPJ5ZA";

function read(body: unknown, userAgent: string | null = null) {
  return readClientErrorReports({ rawBody: JSON.stringify(body), staffToken: STAFF, userAgent });
}

describe("redaction", () => {
  it("replaces the event's staff token wherever it appears", () => {
    const frame = `at tick (https://coverr.example/scan/${STAFF}:12:3)`;
    expect(redactTokens(frame, STAFF)).toBe("at tick (https://coverr.example/scan/:token:12:3)");
  });

  it("replaces a QR token, which the server has no list of", () => {
    expect(redactTokens(`unknown ticket ${QR}`, STAFF)).toBe("unknown ticket #");
  });

  it("replaces a lowercase token too", () => {
    expect(redactTokens("demostaff00000000000000000000000", "")).toBe("#");
  });

  // The errors worth reading at a door are the camera's, and their names are
  // long runs of letters. Losing them would defeat the reporting.
  it("keeps browser error names, which have no digits", () => {
    for (const name of ["OverconstrainedError", "NotReadableError", "SecurityError"]) {
      expect(redactTokens(`${name}: could not start video source`, STAFF)).toContain(name);
    }
  });

  it("keeps ordinary stack frames readable", () => {
    const frame = "at refreshManifest (https://coverr.example/scanner.js:104:23)";
    expect(redactTokens(frame, STAFF)).toBe(frame);
  });

  it("does not split every character when there is no staff token", () => {
    expect(redactTokens("camera failed", "")).toBe("camera failed");
  });
});

describe("reading a batch", () => {
  it("keeps the message, the redacted frames, the device clock and the device", () => {
    const [report] = read(
      {
        reports: [
          {
            message: "Cannot read properties of null (reading 'attendees')",
            stack: `TypeError: ...\n at renderStats (/scan/${STAFF})`,
            at: "2026-10-28T03:14:00.000Z",
          },
        ],
      },
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)",
    );
    expect(report?.message).toBe("Cannot read properties of null (reading 'attendees')");
    expect(report?.stack).toContain("/scan/:token");
    expect(report?.stack).not.toContain(STAFF);
    expect(report?.stack).toContain("On the device at 2026-10-28T03:14:00.000Z");
    expect(report?.stack).toContain("Device: Mozilla/5.0 (iPhone");
  });

  it("redacts a token that reaches the message, not only the stack", () => {
    const [report] = read({ reports: [{ message: `GET /api/scan/${STAFF}/manifest failed` }] });
    expect(report?.message).toBe("GET /api/scan/:token/manifest failed");
  });

  it("stores no stack rather than an empty one when the device sent none", () => {
    const [report] = read({ reports: [{ message: "boom" }] });
    expect(report?.stack).toBeNull();
  });

  it("drops a device clock that is not an ISO timestamp", () => {
    const [report] = read({ reports: [{ message: "boom", at: "<b>yesterday</b>" }] });
    expect(report?.stack).toBeNull();
  });

  it("caps a message that would flood the alert", () => {
    const [report] = read({ reports: [{ message: "x".repeat(5_000) }] });
    expect(report?.message.length).toBe(500);
  });

  it("caps a batch at what the scanner ever queues", () => {
    const reports = Array.from({ length: 50 }, (_, i) => ({ message: `error ${i}` }));
    expect(read({ reports })).toHaveLength(MAX_REPORTS_PER_BATCH);
  });
});

// A device reporting that it is broken may be broken in how it reports.
describe("malformed input", () => {
  it("keeps the good entries in a batch with bad ones", () => {
    const reports = [null, { message: 42 }, { message: "   " }, "text", { message: "real one" }];
    expect(read({ reports }).map((r) => r.message)).toEqual(["real one"]);
  });

  it("reads nothing from a body that is not JSON", () => {
    const result = readClientErrorReports({ rawBody: "{nope", staffToken: STAFF, userAgent: null });
    expect(result).toEqual([]);
  });

  it("reads nothing from JSON that is not a batch", () => {
    expect(read([{ message: "an array, not a batch" }])).toEqual([]);
    expect(read({ reports: "not a list" })).toEqual([]);
  });
});
