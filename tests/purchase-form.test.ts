import { describe, expect, it } from "vitest";
import { checkProofBytes, readPurchaseForm } from "../src/lib/purchase-form";

/**
 * The checkout form, which is the most consequential validation in the
 * product: the buyer has already transferred the money by the time they reach
 * it. Every refusal names the field at fault so the page can point at it —
 * see docs/QA-FINDINGS.md F3.
 */

function file(bytes = 10): File {
  return new File([new Uint8Array(bytes)], "comprobante.png", { type: "image/png" });
}

function form(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    quantity: "1",
    payer_name: "Armando Villafranca",
    payer_email: "vos@ejemplo.com",
    consent: "1",
    attendee_name_1: "Armando Villafranca",
    proof: file(),
    ...over,
  };
}

describe("a complete form", () => {
  it("is accepted", () => {
    const r = readPurchaseForm(form());
    expect(r.ok).toBe(true);
  });

  it("trims whitespace off everything", () => {
    const r = readPurchaseForm(
      form({ payer_name: "  Armando  ", payer_email: " vos@ejemplo.com " }),
    );
    expect(r.ok && r.values.payerName).toBe("Armando");
    expect(r.ok && r.values.payerEmail).toBe("vos@ejemplo.com");
  });

  it("collects one named attendee per ticket", () => {
    const r = readPurchaseForm(
      form({ quantity: "3", attendee_name_2: "Keyla", attendee_name_3: "Marvin" }),
    );
    expect(r.ok && r.values.attendees.map((a) => a.name)).toEqual([
      "Armando Villafranca",
      "Keyla",
      "Marvin",
    ]);
  });

  it("keeps an attendee note and nulls an empty one", () => {
    const r = readPurchaseForm(form({ attendee_note_1: "  me dicen Mando  " }));
    expect(r.ok && r.values.attendees[0].note).toBe("me dicen Mando");
    const blank = readPurchaseForm(form({ attendee_note_1: "   " }));
    expect(blank.ok && blank.values.attendees[0].note).toBeNull();
  });
});

describe("every refusal names its field", () => {
  // Without this the buyer gets a sentence and no idea which box is wrong,
  // having already sent the money.
  const cases: [string, Record<string, unknown>, string][] = [
    ["a missing name", { payer_name: "" }, "payer_name"],
    ["a missing email", { payer_email: "" }, "payer_email"],
    ["a malformed email", { payer_email: "not-an-email" }, "payer_email"],
    ["unticked consent", { consent: undefined }, "consent"],
    ["a missing attendee name", { attendee_name_1: "" }, "attendee_name_1"],
    ["no proof at all", { proof: undefined }, "proof"],
    ["an empty proof file", { proof: file(0) }, "proof"],
  ];

  for (const [label, over, field] of cases) {
    it(`points at ${field} for ${label}`, () => {
      const r = readPurchaseForm(form(over));
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.field).toBe(field);
        expect(r.message.length).toBeGreaterThan(0);
      }
    });
  }

  it("names the right person when a later attendee is missing", () => {
    const r = readPurchaseForm(form({ quantity: "3", attendee_name_2: "Keyla" }));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.field).toBe("attendee_name_3");
      expect(r.message).toContain("3");
    }
  });
});

describe("quantity", () => {
  it("clamps to at least one", () => {
    for (const q of ["0", "-5", "abc", ""]) {
      const r = readPurchaseForm(form({ quantity: q }));
      expect(r.ok && r.values.quantity).toBe(1);
    }
  });

  it("caps at ten, so one order cannot take an entire allocation", () => {
    const over = { quantity: "99" } as Record<string, unknown>;
    for (let i = 1; i <= 10; i++) over[`attendee_name_${i}`] = `Persona ${i}`;
    const r = readPurchaseForm(form(over));
    expect(r.ok && r.values.quantity).toBe(10);
  });
});

describe("the proof", () => {
  // It is the entire basis of verification: an order without one cannot be
  // checked by any rule.
  it("is mandatory", () => {
    expect(readPurchaseForm(form({ proof: undefined })).ok).toBe(false);
  });

  it("is rejected above 10 MB", () => {
    const r = readPurchaseForm(form({ proof: file(10 * 1024 * 1024 + 1) }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toContain("10 MB");
  });

  it("accepts a file at exactly the limit", () => {
    expect(readPurchaseForm(form({ proof: file(10 * 1024 * 1024) })).ok).toBe(true);
  });
});

describe("money never comes from the client", () => {
  // The buyer's browser can say anything; the server re-resolves the price.
  // If this ever starts reading an amount from the form, that invariant is
  // gone and this test should fail loudly.
  it("parses no price, rule id or amount out of the form", () => {
    const r = readPurchaseForm(
      form({ amount: "1", price: "1", price_rule_id: "pr_free", expected_amount: "0" }),
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(Object.keys(r.values)).not.toContain("amount");
      expect(Object.keys(r.values)).not.toContain("priceRuleId");
      expect(Object.keys(r.values)).not.toContain("expectedAmount");
    }
  });
});

describe("checkProofBytes", () => {
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);

  it("accepts a real screenshot and reports its true type", () => {
    const r = checkProofBytes(png);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.contentType).toBe("image/png");
  });

  it("refuses anything else, pointing at the upload", () => {
    const r = checkProofBytes(new TextEncoder().encode("<script>alert(1)</script>"));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.field).toBe("proof");
      expect(r.message).toContain("imagen");
    }
  });

  // The buyer did nothing wrong, so the message has to say what to do instead
  // of just refusing them while they stand in a queue.
  it("tells an iPhone buyer how to get a readable file", () => {
    const heic = new Uint8Array([
      0,
      0,
      0,
      0x18,
      ...[..."ftypheic    "].map((c) => c.charCodeAt(0)),
    ]);
    const r = checkProofBytes(heic);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/captura|JPG/);
  });
});

// Strangers fill this form in, and what they type reaches the band's pages,
// the tickets, the emails and the door's offline list.
describe("length limits", () => {
  it("refuses a payer name past the limit and points at it", () => {
    const r = readPurchaseForm(form({ payer_name: "A".repeat(81) }));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.field).toBe("payer_name");
      expect(r.message).toBe("Tu nombre puede tener hasta 80 caracteres.");
    }
  });

  it("accepts a name exactly at the limit", () => {
    expect(readPurchaseForm(form({ payer_name: "A".repeat(80) })).ok).toBe(true);
  });

  it("refuses an over-long attendee note and names the person", () => {
    const r = readPurchaseForm(form({ attendee_note_1: "x".repeat(201) }));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.field).toBe("attendee_note_1");
      expect(r.message).toContain("persona 1");
    }
  });

  it("refuses an over-long phone", () => {
    const r = readPurchaseForm(form({ payer_phone: "9".repeat(31) }));
    expect(!r.ok && r.field).toBe("payer_phone");
  });
});

// Both arrive from inputs the page filled in. A value the page could not have
// sent is dropped, never stored as the buyer typed it.
describe("fields the page fills in", () => {
  it("keeps a short code shaped like ours", () => {
    const r = readPurchaseForm(form({ short_code: "RUI-7JC4" }));
    expect(r.ok && r.values.shortCode).toBe("RUI-7JC4");
  });

  it("ignores anything else, so the server makes a fresh code", () => {
    for (const code of ["<b>x</b>", "RUI-7JC4-EXTRA", "rui-7jc4", "X".repeat(5000)]) {
      const r = readPurchaseForm(form({ short_code: code }));
      expect(r.ok && r.values.shortCode).toBeNull();
    }
  });

  it("keeps a real bank code and drops anything else", () => {
    const kept = readPurchaseForm(form({ bank: "FICOHSA" }));
    expect(kept.ok && kept.values.bankSelected).toBe("FICOHSA");
    const dropped = readPurchaseForm(form({ bank: "Banco de mentira" }));
    expect(dropped.ok && dropped.values.bankSelected).toBeNull();
  });
});
