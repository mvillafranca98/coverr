import { describe, expect, it } from "vitest";
import {
  confirmsDeletion,
  deletionBlockers,
  EVENT_OVER_AFTER_HOURS,
  UNSETTLED_FEE_STATUSES,
  type UnansweredRefund,
  type UnsettledFee,
} from "../src/lib/account-deletion";

/**
 * Deleting an account is irreversible and takes buyers' tickets with it. The
 * rules here decide when that would walk out on somebody who paid, and when a
 * band clearly means it.
 */

const NOW = new Date("2026-10-28T20:00:00Z");
const hoursFromNow = (hours: number) => new Date(NOW.getTime() + hours * 3_600_000).toISOString();

const refundOn = (shortCode: string): UnansweredRefund => ({
  eventSlug: "noche",
  eventName: "Noche",
  orderId: `ord_${shortCode}`,
  shortCode,
});

function blockers(
  events: { name: string; startsAt: string; liveTickets: number }[],
  unansweredRefunds: { count: number; orders: UnansweredRefund[] } = { count: 0, orders: [] },
  unsettledFees: UnsettledFee[] = [],
) {
  return deletionBlockers({ events, unansweredRefunds, unsettledFees, now: NOW });
}

const noRefunds = { count: 0, orders: [] };

describe("what stops a deletion", () => {
  it("is nothing for a band whose events are all over", () => {
    expect(
      blockers([{ name: "Jungla 01/08", startsAt: hoursFromNow(-72), liveTickets: 92 }]),
    ).toEqual([]);
  });

  it("is an upcoming event that still has live tickets", () => {
    expect(
      blockers([{ name: "Noche de Ruido", startsAt: hoursFromNow(48), liveTickets: 3 }]),
    ).toEqual([
      {
        kind: "upcoming_event",
        eventName: "Noche de Ruido",
        startsAt: hoursFromNow(48),
        liveTickets: 3,
      },
    ]);
  });

  // Doors open, people inside, the band deletes from the bar: the codes still
  // in the queue would stop scanning.
  it("is an event happening right now", () => {
    expect(blockers([{ name: "Hoy", startsAt: hoursFromNow(-2), liveTickets: 40 }])).toHaveLength(
      1,
    );
  });

  it("stops being an event once the night is over", () => {
    const justOver = hoursFromNow(-EVENT_OVER_AFTER_HOURS - 0.01);
    expect(blockers([{ name: "Anoche", startsAt: justOver, liveTickets: 40 }])).toEqual([]);
  });

  it("is not an upcoming event nobody has bought into yet", () => {
    expect(blockers([{ name: "Borrador", startsAt: hoursFromNow(240), liveTickets: 0 }])).toEqual(
      [],
    );
  });

  // When in doubt the buyers are the ones who would lose.
  it("treats an event with an unreadable date as upcoming", () => {
    expect(blockers([{ name: "¿?", startsAt: "pronto", liveTickets: 1 }])).toHaveLength(1);
  });

  it("is a refund request nobody has answered, even with every event over", () => {
    const orders = [refundOn("PRU-AAAA"), refundOn("PRU-BBBB")];
    expect(blockers([], { count: 2, orders })).toEqual([
      { kind: "open_refunds", count: 2, orders },
    ]);
  });

  // The page links the first few; the count still says how many there are.
  it("counts every unanswered request, not only the ones it can link", () => {
    expect(blockers([], { count: 14, orders: [refundOn("PRU-AAAA")] })).toEqual([
      { kind: "open_refunds", count: 14, orders: [refundOn("PRU-AAAA")] },
    ]);
  });

  // Deleting takes the fee rows with it: without this, delete and sign up again
  // would wipe the debt and bring back the free first event.
  it("is a report fee marked unpaid, named as owed", () => {
    expect(
      blockers([], noRefunds, [{ eventName: "Noche", amount: 50_000, status: "unpaid" }]),
    ).toEqual([{ kind: "unsettled_fee", eventName: "Noche", amount: 50_000, owed: true }]);
  });

  // The report opens on the upload, before anyone has looked at the screenshot.
  it("is a fee still being checked or waiting for an operator, not yet owed", () => {
    const found = blockers([], noRefunds, [
      { eventName: "A", amount: 50_000, status: "checking" },
      { eventName: "B", amount: 80_000, status: "flagged" },
    ]);
    expect(found.map((b) => b.kind === "unsettled_fee" && b.owed)).toEqual([false, false]);
  });

  it("never holds a deletion for a fee that passed its checks or was settled", () => {
    expect(UNSETTLED_FEE_STATUSES).not.toContain("ok");
    expect(UNSETTLED_FEE_STATUSES).not.toContain("resolved");
  });

  it("names every reason at once, so the band fixes them in one pass", () => {
    const found = blockers(
      [
        { name: "A", startsAt: hoursFromNow(24), liveTickets: 1 },
        { name: "B", startsAt: hoursFromNow(96), liveTickets: 5 },
      ],
      { count: 1, orders: [refundOn("PRU-AAAA")] },
      [{ eventName: "C", amount: 50_000, status: "unpaid" }],
    );
    expect(found.map((b) => b.kind)).toEqual([
      "upcoming_event",
      "upcoming_event",
      "open_refunds",
      "unsettled_fee",
    ]);
  });
});

describe("confirming", () => {
  it("accepts the band's name", () => {
    expect(confirmsDeletion("Los Últimos", "Los Últimos")).toBe(true);
  });

  it("forgives case, accents and stray spaces", () => {
    expect(confirmsDeletion("  los   ultimos ", "Los Últimos")).toBe(true);
  });

  it("refuses an empty box", () => {
    expect(confirmsDeletion("", "Jungla")).toBe(false);
    expect(confirmsDeletion("   ", "Jungla")).toBe(false);
  });

  it("refuses a different name", () => {
    expect(confirmsDeletion("Jungla", "Jungla Sound")).toBe(false);
  });

  it("never confirms against a band with no name", () => {
    expect(confirmsDeletion("", "")).toBe(false);
  });
});
