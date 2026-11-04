import { describe, expect, it } from "vitest";
import type { ProofFields } from "../src/lib/extract";
import { type FlagCode, flagLabel, verifyProof, worstSeverity } from "../src/lib/verify";

/**
 * The eight rules that decide whether a buyer's proof raises a flag.
 *
 * Every case here is one somebody could stand at a door and argue about, which
 * is the whole point of the rules being deterministic — a flag has to have a
 * reason that can be said out loud.
 */

const BAND_ACCOUNT = "748427371";
const SALE_OPENED = "2026-09-01T00:00:00Z";

/** A clean BAC transfer for L200 that should raise nothing. */
function proof(over: Partial<ProofFields> = {}): ProofFields {
  return {
    doc_type: "app_notification",
    is_payment_confirmation: true,
    bank: "BAC",
    sender_name: "Armando Villafranca",
    sender_account: "111111111",
    dest_account: BAND_ACCOUNT,
    dest_name: "ARMANDO VILLAFRANCA",
    amount: 200,
    currency: "HNL",
    datetime: "2026-09-20T19:30:00-06:00",
    reference: "412447811",
    detail: null,
    legible: true,
    ...over,
  };
}

function codes(
  fields: ProofFields,
  over: Partial<Parameters<typeof verifyProof>[0]> = {},
): FlagCode[] {
  return verifyProof({
    fields,
    expectedAmount: 20000,
    payerName: "Armando Villafranca",
    bandAccounts: [BAND_ACCOUNT],
    eventCreatedAt: SALE_OPENED,
    knownReferences: new Set<string>(),
    ...over,
  }).map((f) => f.code);
}

describe("a clean proof", () => {
  it("raises nothing", () => {
    expect(codes(proof())).toEqual([]);
  });
});

describe("NOT_A_RECEIPT", () => {
  it("fires when the document is not a transfer confirmation", () => {
    expect(codes(proof({ is_payment_confirmation: false }))).toEqual(["NOT_A_RECEIPT"]);
  });

  it("stops every other check, because nothing else can be trusted", () => {
    const flags = codes(
      proof({ is_payment_confirmation: false, amount: 1, dest_account: "999999999" }),
    );
    expect(flags).toEqual(["NOT_A_RECEIPT"]);
  });
});

describe("amounts", () => {
  // The tolerance was removed deliberately: a transfer funded in another
  // currency can convert to slightly off, and that is an order to review
  // rather than one to accept silently. See QA-FINDINGS F6.
  it("flags a payment one lempira short", () => {
    expect(codes(proof({ amount: 199 }))).toContain("AMOUNT_SHORT");
  });

  it("flags a payment one lempira over", () => {
    expect(codes(proof({ amount: 201 }))).toContain("AMOUNT_OVER");
  });

  it("flags a single centavo short", () => {
    expect(codes(proof({ amount: 199.99 }))).toContain("AMOUNT_SHORT");
  });

  it("accepts the exact amount", () => {
    expect(codes(proof({ amount: 200 }))).toEqual([]);
  });

  it("says nothing when the amount could not be read", () => {
    expect(codes(proof({ amount: null }))).toEqual([]);
  });

  it("says nothing when the order is free, so comps never flag", () => {
    expect(codes(proof({ amount: 0 }), { expectedAmount: 0 })).toEqual([]);
  });
});

describe("DEST_MISMATCH", () => {
  it("fires when the money went to an account that is not the band's", () => {
    expect(codes(proof({ dest_account: "999999999" }))).toContain("DEST_MISMATCH");
  });

  it("accepts a masked account matching on the last four digits", () => {
    // BAC's alert email prints *****7371 rather than the full number.
    expect(codes(proof({ dest_account: "*****7371" }))).toEqual([]);
  });

  it("accepts an account printed with spaces", () => {
    expect(codes(proof({ dest_account: "748 427 371" }))).toEqual([]);
  });

  it("rejects a masked account whose last four differ", () => {
    expect(codes(proof({ dest_account: "*****9999" }))).toContain("DEST_MISMATCH");
  });

  it("says nothing when the band has no accounts on file to compare against", () => {
    expect(codes(proof({ dest_account: "999999999" }), { bandAccounts: [] })).toEqual([]);
  });
});

describe("REF_DUPLICATE", () => {
  it("fires when the reference was already seen", () => {
    expect(codes(proof(), { knownReferences: new Set(["412447811"]) })).toContain("REF_DUPLICATE");
  });

  it("compares on digits, so punctuation does not hide a reuse", () => {
    expect(
      codes(proof({ reference: "4124-4781-1" }), { knownReferences: new Set(["412447811"]) }),
    ).toContain("REF_DUPLICATE");
  });

  it("is critical, because a recycled reference is the closest thing to a forgery", () => {
    const flags = verifyProof({
      fields: proof(),
      expectedAmount: 20000,
      payerName: "Armando Villafranca",
      bandAccounts: [BAND_ACCOUNT],
      eventCreatedAt: SALE_OPENED,
      knownReferences: new Set(["412447811"]),
    });
    expect(flags.find((f) => f.code === "REF_DUPLICATE")?.severity).toBe("critical");
  });
});

describe("DATE_STALE", () => {
  it("fires for a transfer made well before the sale opened", () => {
    expect(codes(proof({ datetime: "2026-07-01T10:00:00Z" }))).toContain("DATE_STALE");
  });

  // The regression that actually happened: BAC's app notification prints
  // "15 octubre" with no year, the extractor returns "10-15", and
  // new Date("10-15") is the year 2001 — read as a transfer made twenty-five
  // years before the sale. A date we cannot place must raise nothing.
  it("ignores a date with no year rather than inventing one", () => {
    expect(codes(proof({ datetime: "10-15" }))).toEqual([]);
  });

  it("ignores a day-and-month-only date in any shape", () => {
    for (const d of ["15 octubre", "10/15", "15-10", ""]) {
      expect(codes(proof({ datetime: d }))).toEqual([]);
    }
  });

  it("allows a transfer made the day before the sale opened", () => {
    // A day of slack absorbs timezones and a buyer paying just ahead of launch.
    expect(codes(proof({ datetime: "2026-08-31T12:00:00Z" }))).toEqual([]);
  });
});

describe("NAME_MISMATCH", () => {
  it("fires when the payer is somebody else entirely", () => {
    expect(codes(proof({ sender_name: "Keyla Discua" }))).toContain("NAME_MISMATCH");
  });

  it("is info severity, so the door never sees it", () => {
    // One person paying for four is the common case, not the suspicious one.
    const flags = verifyProof({
      fields: proof({ sender_name: "Keyla Discua" }),
      expectedAmount: 20000,
      payerName: "Armando Villafranca",
      bandAccounts: [BAND_ACCOUNT],
      eventCreatedAt: SALE_OPENED,
      knownReferences: new Set<string>(),
    });
    expect(flags.find((f) => f.code === "NAME_MISMATCH")?.severity).toBe("info");
  });

  it("matches across accents and case", () => {
    expect(codes(proof({ sender_name: "ARMÁNDO VILLAFRÁNCA" }))).toEqual([]);
  });

  it("matches when one side carries extra middle names", () => {
    expect(codes(proof({ sender_name: "Armando Anibal Villafranca Altamirano" }))).toEqual([]);
  });

  it("says nothing when the sender name was not readable", () => {
    expect(codes(proof({ sender_name: null }))).toEqual([]);
  });
});

describe("UNREADABLE", () => {
  it("fires when the image could not be read, without blocking anything else", () => {
    const flags = codes(proof({ legible: false, amount: 199 }));
    expect(flags).toContain("UNREADABLE");
    expect(flags).toContain("AMOUNT_SHORT");
  });
});

describe("several problems at once", () => {
  it("reports every rule that fired, not just the first", () => {
    const flags = codes(
      proof({ amount: 50, dest_account: "999999999", sender_name: "Otra Persona" }),
      {
        knownReferences: new Set(["412447811"]),
      },
    );
    expect(flags).toEqual(
      expect.arrayContaining(["REF_DUPLICATE", "DEST_MISMATCH", "AMOUNT_SHORT", "NAME_MISMATCH"]),
    );
  });
});

describe("worstSeverity", () => {
  it("ranks critical above warning above info", () => {
    expect(worstSeverity([{ code: "UNREADABLE", severity: "info", detail: "" }])).toBe("info");
    expect(
      worstSeverity([
        { code: "UNREADABLE", severity: "info", detail: "" },
        { code: "AMOUNT_SHORT", severity: "warning", detail: "" },
      ]),
    ).toBe("warning");
    expect(
      worstSeverity([
        { code: "AMOUNT_SHORT", severity: "warning", detail: "" },
        { code: "REF_DUPLICATE", severity: "critical", detail: "" },
      ]),
    ).toBe("critical");
  });

  it("returns null when nothing fired", () => {
    expect(worstSeverity([])).toBeNull();
  });
});

describe("flagLabel", () => {
  it("names each check in Spanish for the band", () => {
    expect(flagLabel("AMOUNT_SHORT")).toBe("Pagó de menos");
    expect(flagLabel("NAME_MISMATCH")).toBe("Pagó otra persona");
  });

  it("falls back to the code for one it does not know", () => {
    expect(flagLabel("SOMETHING_NEW")).toBe("SOMETHING_NEW");
  });
});
