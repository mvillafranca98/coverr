import { describe, expect, it } from "vitest";
import { readEventForm, typedEventValues } from "../src/lib/event-form";

/**
 * The checks on prices and doors. Both decide what a buyer is charged: presale
 * ends at doors, and a price is what the buyer is told to transfer.
 */

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

function messageFor(over: Record<string, unknown>): string | null {
  const result = readEventForm(event(over));
  return result.ok ? null : result.message;
}

describe("event prices", () => {
  it("refuses a price of zero for either sale", () => {
    expect(messageFor({ presale_amount: "0" })).toBe(
      "El precio de preventa tiene que ser mayor que cero.",
    );
    expect(messageFor({ door_amount: "0" })).toBe(
      "El precio de taquilla tiene que ser mayor que cero.",
    );
  });

  it("refuses a negative price", () => {
    expect(messageFor({ presale_amount: "-5" })).toBe(
      "El precio de preventa tiene que ser mayor que cero.",
    );
  });

  it("still asks for a blank price by name", () => {
    expect(messageFor({ presale_amount: "" })).toBe("Falta el precio de preventa.");
  });

  it("accepts one lempira", () => {
    expect(messageFor({ presale_amount: "1", door_amount: "2" })).toBeNull();
  });
});

describe("doors time", () => {
  it("accepts doors a few hours before the start, including the night before", () => {
    expect(messageFor({ doors_at: "2026-11-20T19:00" })).toBeNull();
    expect(messageFor({ starts_at: "2026-11-21T00:30", doors_at: "2026-11-20T22:00" })).toBeNull();
  });

  it("accepts doors at the start time itself, and no doors at all", () => {
    expect(messageFor({ doors_at: "2026-11-20T21:00" })).toBeNull();
    expect(messageFor({ doors_at: "" })).toBeNull();
  });

  it("refuses doors after the start", () => {
    expect(messageFor({ doors_at: "2026-11-20T22:00" })).toBe(
      "Puertas tiene que ser antes de que empiece el evento.",
    );
  });

  it("refuses doors on an earlier day, which would end presale early", () => {
    expect(messageFor({ doors_at: "2026-11-19T20:00" })).toBe(
      "Puertas tiene que ser como mucho 12 horas antes de que empiece. Revisá el día.",
    );
  });

  it("refuses a doors value that is not a date and time", () => {
    expect(messageFor({ doors_at: "20:00" })).toBe("Revisá la hora de puertas.");
  });
});

describe("a refused form comes back filled in", () => {
  it("keeps what was typed, including the value that was refused", () => {
    const typed = typedEventValues(event({ doors_at: "2026-11-19T20:00", presale_max: "30" }));
    expect(typed).toMatchObject({
      name: "Noche de Ruido",
      startsAt: "2026-11-20T21:00",
      doorsAt: "2026-11-19T20:00",
      presaleAmount: 20000,
      doorAmount: 25000,
      presaleMaxQty: 30,
    });
  });

  it("leaves a blank price blank rather than inventing one", () => {
    expect(typedEventValues(event({ presale_amount: "" })).presaleAmount).toBeUndefined();
  });
});
