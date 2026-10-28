import { describe, expect, it } from "vitest";
import {
  MAX_REPORTS_PER_BATCH,
  pagePattern,
  readClientErrorReports,
  redactTokens,
} from "../src/lib/client-error";

/**
 * Browser error reports end in an email. The staff link opens the scanner, a
 * QR token gets somebody through the door, and an order id in a ticket-page
 * address shows that order's tickets — so none of them may survive into one,
 * and the camera errors that are the whole point of reporting must.
 */

const STAFF = "7K2M9QXH4RT8VB3NWC";
const QR = "4D9X7K2M0QH8RT3VBN6WCPJ5ZA";
// The shape `newId("ord")` produces: base36 milliseconds, then 8 random.
const ORDER = "ord_mvsftjq3y42qf45w";

function read(body: unknown, userAgent: string | null = null) {
  return readClientErrorReports({
    rawBody: JSON.stringify(body),
    knownTokens: [STAFF],
    userAgent,
  });
}

describe("redaction", () => {
  it("replaces a known token wherever it appears", () => {
    const frame = `at tick (https://coverr.example/scan/${STAFF}:12:3)`;
    expect(redactTokens(frame, [STAFF])).toBe("at tick (https://coverr.example/scan/:token:12:3)");
  });

  it("replaces a QR token, which the server has no list of", () => {
    expect(redactTokens(`unknown ticket ${QR}`, [])).toBe("unknown ticket #");
  });

  // An inline script's stack frame names the page it runs on, and on the
  // ticket page that address is the key to the order.
  it("replaces an order id in a ticket-page address", () => {
    const frame = `at drawCodes (https://coverr.example/boletos/${ORDER}:41:9)`;
    expect(redactTokens(frame, [])).toBe(
      "at drawCodes (https://coverr.example/boletos/ord_#:41:9)",
    );
  });

  it("replaces a lowercase token too", () => {
    expect(redactTokens("demostaff00000000000000000000000", [])).toBe("#");
  });

  // The errors worth reading at a door are the camera's, and their names are
  // long runs of letters. Losing them would defeat the reporting.
  it("keeps browser error names, which have no digits", () => {
    for (const name of ["OverconstrainedError", "NotReadableError", "SecurityError"]) {
      expect(redactTokens(`${name}: could not start video source`, [STAFF])).toContain(name);
    }
  });

  it("keeps ordinary stack frames readable", () => {
    const frame = "at refreshManifest (https://coverr.example/scanner.js:104:23)";
    expect(redactTokens(frame, [STAFF])).toBe(frame);
  });

  it("keeps a user agent's version numbers", () => {
    const agent = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0) AppleWebKit/605.1.15 Safari/604.1";
    expect(redactTokens(agent, [])).toBe(agent);
  });

  it("ignores an empty known token rather than splitting on every character", () => {
    expect(redactTokens("camera failed", [""])).toBe("camera failed");
  });
});

describe("the page a report came from", () => {
  it("takes the order id out of a ticket page", () => {
    expect(pagePattern(`/boletos/${ORDER}`)).toBe("/boletos/:id");
  });

  it("takes the token out of a QR image path", () => {
    expect(pagePattern(`/t/${QR}.png`)).toBe("/t/:id");
  });

  it("keeps route names and a public event slug", () => {
    expect(pagePattern("/e/noche-de-ruido/comprar")).toBe("/e/noche-de-ruido/comprar");
  });

  it("treats a slug with digits like any other id", () => {
    expect(pagePattern("/e/jungla-01-08")).toBe("/e/:id");
  });

  it("keeps the landing page as itself", () => {
    expect(pagePattern("/")).toBe("/");
  });

  it("refuses anything that is not a path", () => {
    expect(pagePattern("https://elsewhere.example/")).toBeNull();
    expect(pagePattern(42)).toBeNull();
    expect(pagePattern(`/${"a".repeat(400)}`)).toBeNull();
  });
});

describe("reading a batch", () => {
  it("keeps the message, the redacted frames, the device clock and the device", () => {
    const { reports } = read(
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
    const [report] = reports;
    expect(report?.message).toBe("Cannot read properties of null (reading 'attendees')");
    expect(report?.stack).toContain("/scan/:token");
    expect(report?.stack).not.toContain(STAFF);
    expect(report?.stack).toContain("On the device at 2026-10-28T03:14:00.000Z");
    expect(report?.stack).toContain("Device: Mozilla/5.0 (iPhone");
  });

  it("hands back the page as sent, for pagePattern to clean", () => {
    expect(read({ page: `/boletos/${ORDER}`, reports: [] }).page).toBe(`/boletos/${ORDER}`);
  });

  it("redacts a token that reaches the message, not only the stack", () => {
    const { reports } = read({ reports: [{ message: `GET /api/scan/${STAFF}/manifest failed` }] });
    expect(reports[0]?.message).toBe("GET /api/scan/:token/manifest failed");
  });

  it("stores no stack rather than an empty one when the device sent none", () => {
    expect(read({ reports: [{ message: "boom" }] }).reports[0]?.stack).toBeNull();
  });

  it("drops a device clock that is not an ISO timestamp", () => {
    const { reports } = read({ reports: [{ message: "boom", at: "<b>yesterday</b>" }] });
    expect(reports[0]?.stack).toBeNull();
  });

  it("caps a message that would flood the alert", () => {
    const { reports } = read({ reports: [{ message: "x".repeat(5_000) }] });
    expect(reports[0]?.message.length).toBe(500);
  });

  it("caps a batch at what any reporter ever sends", () => {
    const reports = Array.from({ length: 50 }, (_, i) => ({ message: `error ${i}` }));
    expect(read({ reports }).reports).toHaveLength(MAX_REPORTS_PER_BATCH);
  });
});

// A page reporting that it is broken may be broken in how it reports.
describe("malformed input", () => {
  it("keeps the good entries in a batch with bad ones", () => {
    const reports = [null, { message: 42 }, { message: "   " }, "text", { message: "real one" }];
    expect(read({ reports }).reports.map((r) => r.message)).toEqual(["real one"]);
  });

  it("reads nothing from a body that is not JSON", () => {
    const result = readClientErrorReports({ rawBody: "{nope", knownTokens: [], userAgent: null });
    expect(result).toEqual({ page: null, reports: [] });
  });

  it("reads nothing from JSON that is not a batch", () => {
    expect(read([{ message: "an array, not a batch" }]).reports).toEqual([]);
    expect(read({ reports: "not a list" }).reports).toEqual([]);
  });
});
