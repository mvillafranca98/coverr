import { afterEach, describe, expect, it, vi } from "vitest";
import { refundGate } from "../src/lib/refund-policy";

/**
 * Whether a buyer can still ask for their money back.
 *
 * The window is measured from the moment of purchase and never consults the
 * show date — see docs/QA-FINDINGS.md F2, which is an open product decision
 * rather than a bug. These tests describe what the code does today so that
 * changing it is a deliberate act rather than an accident.
 */

const NOW = new Date("2026-10-20T12:00:00Z");

function order(over: Partial<Parameters<typeof refundGate>[0]> = {}) {
  return {
    status: "confirmed",
    createdAt: "2026-10-20T10:00:00Z", // two hours ago
    channel: "online",
    refundPolicy: "24h",
    ...over,
  };
}

afterEach(() => {
  vi.useRealTimers();
});

function at(now: Date) {
  vi.useFakeTimers();
  vi.setSystemTime(now);
}

describe("inside the window", () => {
  it("is open two hours after purchase", () => {
    at(NOW);
    expect(refundGate(order()).open).toBe(true);
  });

  it("is open at 23 hours 59 minutes", () => {
    at(NOW);
    expect(refundGate(order({ createdAt: "2026-10-19T12:01:00Z" })).open).toBe(true);
  });
});

describe("outside the window", () => {
  it("is closed at 24 hours and one minute", () => {
    at(NOW);
    const gate = refundGate(order({ createdAt: "2026-10-19T11:59:00Z" }));
    expect(gate.open).toBe(false);
    if (!gate.open) expect(gate.headline).toContain("24 horas");
  });

  // The consequence worth seeing written down: a presale buyer three months
  // out loses the window the next day, long before the gig.
  it("is closed for a presale buyer who bought months before the show", () => {
    at(NOW);
    expect(refundGate(order({ createdAt: "2026-07-01T10:00:00Z" })).open).toBe(false);
  });
});

describe("policies that close the window regardless of time", () => {
  it("refuses when the order was sold with no refunds", () => {
    at(NOW);
    const gate = refundGate(order({ refundPolicy: "none" }));
    expect(gate.open).toBe(false);
    if (!gate.open) expect(gate.headline).toContain("no admite reembolsos");
  });

  // Nothing was paid, so there is nothing to return.
  it("refuses a comp", () => {
    at(NOW);
    const gate = refundGate(order({ channel: "comp" }));
    expect(gate.open).toBe(false);
    if (!gate.open) expect(gate.headline).toBe("Cortesía");
  });

  it("refuses an order already refunded", () => {
    at(NOW);
    expect(refundGate(order({ status: "refunded" })).open).toBe(false);
  });

  it("refuses an order already voided", () => {
    at(NOW);
    expect(refundGate(order({ status: "void" })).open).toBe(false);
  });
});

describe("the policy is read off the order, not the event", () => {
  // A band editing the event later must never close a window a buyer was
  // shown and agreed to at checkout.
  it("honours a 24h order even when it is the only thing saying so", () => {
    at(NOW);
    expect(refundGate(order({ refundPolicy: "24h" })).open).toBe(true);
  });
});

describe("every refusal explains itself", () => {
  // Staff and buyers both read these. A refusal with no reason is the thing
  // that generates a phone call.
  it("always carries a headline and a detail", () => {
    at(NOW);
    const refusals = [
      order({ status: "refunded" }),
      order({ status: "void" }),
      order({ channel: "comp" }),
      order({ refundPolicy: "none" }),
      order({ createdAt: "2026-01-01T00:00:00Z" }),
    ];
    for (const o of refusals) {
      const gate = refundGate(o);
      expect(gate.open).toBe(false);
      if (!gate.open) {
        expect(gate.headline.length).toBeGreaterThan(0);
        expect(gate.detail.length).toBeGreaterThan(0);
      }
    }
  });
});
