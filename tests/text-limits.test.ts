import { describe, expect, it } from "vitest";
import { readEventForm } from "../src/lib/event-form";
import { TEXT_LIMITS, tooLong } from "../src/lib/text-limits";

/**
 * Free text a band types is printed on every buyer's page and ticket, so each
 * kind has a ceiling — refused with a message that says the limit, never
 * silently cut.
 */

describe("tooLong", () => {
  it("says the field and the limit", () => {
    expect(tooLong("x".repeat(121), 120, "El nombre del evento")).toBe(
      "El nombre del evento puede tener hasta 120 caracteres.",
    );
  });

  it("is quiet when the text fits, including exactly at the limit", () => {
    expect(tooLong("x".repeat(120), 120, "El lugar")).toBeNull();
    expect(tooLong("", 120, "El lugar")).toBeNull();
  });
});

describe("the event form", () => {
  function event(over: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      name: "Noche de Ruido",
      venue: "Casa Quinchón",
      starts_at: "2026-11-20T21:00",
      presale_amount: "200",
      door_amount: "250",
      ...over,
    };
  }

  it("accepts an ordinary event", () => {
    expect(readEventForm(event()).ok).toBe(true);
  });

  it("refuses a name, venue or description past its limit", () => {
    const cases: [string, number, string][] = [
      ["name", TEXT_LIMITS.eventName, "El nombre del evento"],
      ["venue", TEXT_LIMITS.venue, "El lugar"],
      ["description", TEXT_LIMITS.description, "La descripción"],
      ["thank_you", TEXT_LIMITS.thankYouNote, "La nota de agradecimiento"],
    ];
    for (const [field, max, label] of cases) {
      const r = readEventForm(event({ [field]: "x".repeat(max + 1) }));
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.message).toBe(`${label} puede tener hasta ${max} caracteres.`);
    }
  });
});
