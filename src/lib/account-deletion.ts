/**
 * When a band may delete its account, and how it says it means it.
 *
 * Deletion is total and immediate — see `routes/admin/account-deletion.tsx`.
 * What it must not do is walk out on people who already paid. The terms say a
 * band's events are kept while it still owes buyers something, so deletion is
 * refused, with the reason named, while any of these is true:
 *
 *  - an event that has not happened yet still has live tickets. Deleting
 *    would void QR codes people paid for, with nobody left to refund them.
 *  - a buyer has asked for a refund and nobody has answered.
 *  - a report fee Coverr has not accepted as paid. Deleting takes the band's
 *    fee rows with it, so otherwise a band could open a report on any
 *    screenshot, or after being marked unpaid, delete, and sign up again to a
 *    clean slate and another free first event.
 *
 * Each is something the band can resolve — refund, cancel, wait for the night
 * to pass, answer the request, pay — so the right to leave is delayed, never
 * denied.
 */

import type { FeeStatus } from "./fees";

/**
 * How long after its start an event counts as over. A gig that starts at
 * 21:00 is over by 09:00 the next morning; nobody is still owed a door.
 */
export const EVENT_OVER_AFTER_HOURS = 12;

/** An order a buyer asked to refund that nobody has answered yet. */
export type UnansweredRefund = {
  eventSlug: string;
  eventName: string;
  orderId: string;
  shortCode: string;
};

/**
 * The fee statuses that hold a deletion. `ok` passed the checks and `resolved`
 * was settled by an operator; `checking` lasts the few seconds the checks
 * take, and `flagged` waits for an operator to look.
 */
export const UNSETTLED_FEE_STATUSES = [
  "checking",
  "flagged",
  "unpaid",
] as const satisfies readonly FeeStatus[];

/** A report fee of this band's that Coverr has not accepted as paid. */
export type UnsettledFee = {
  eventName: string;
  /** Centavos. */
  amount: number;
  status: (typeof UNSETTLED_FEE_STATUSES)[number];
};

export type DeletionBlocker =
  | { kind: "upcoming_event"; eventName: string; startsAt: string; liveTickets: number }
  | { kind: "open_refunds"; count: number; orders: UnansweredRefund[] }
  /** `owed` when an operator marked it unpaid; otherwise it is still being checked. */
  | { kind: "unsettled_fee"; eventName: string; amount: number; owed: boolean };

/**
 * Everything standing between the band and deleting its account. Empty means
 * it may go ahead.
 *
 * An event whose date cannot be read blocks as if it were upcoming: when in
 * doubt, the buyers are the ones who would lose.
 */
export function deletionBlockers(input: {
  events: { name: string; startsAt: string; liveTickets: number }[];
  /** How many orders have an unanswered request, and the first of them to link to. */
  unansweredRefunds: { count: number; orders: UnansweredRefund[] };
  unsettledFees: UnsettledFee[];
  now: Date;
}): DeletionBlocker[] {
  const overIfStartedBefore = input.now.getTime() - EVENT_OVER_AFTER_HOURS * 3_600_000;

  const upcoming: DeletionBlocker[] = input.events
    .filter((event) => event.liveTickets > 0)
    .filter((event) => !(new Date(event.startsAt).getTime() <= overIfStartedBefore))
    .map((event) => ({
      kind: "upcoming_event",
      eventName: event.name,
      startsAt: event.startsAt,
      liveTickets: event.liveTickets,
    }));

  const { count, orders } = input.unansweredRefunds;
  const refunds: DeletionBlocker[] = count > 0 ? [{ kind: "open_refunds", count, orders }] : [];

  const fees: DeletionBlocker[] = input.unsettledFees.map((fee) => ({
    kind: "unsettled_fee",
    eventName: fee.eventName,
    amount: fee.amount,
    owed: fee.status === "unpaid",
  }));

  return [...upcoming, ...refunds, ...fees];
}

/**
 * True when what was typed is the band's name.
 *
 * Forgiving about case, accents and spacing — the point is a deliberate act,
 * not a spelling test — and strict about everything else: an empty box, or a
 * name typed for a different band, never confirms.
 */
export function confirmsDeletion(typed: string, bandName: string): boolean {
  const expected = comparable(bandName);
  return expected.length > 0 && comparable(typed) === expected;
}

function comparable(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}
