import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import {
  UNSETTLED_FEE_STATUSES,
  type UnansweredRefund,
  type UnsettledFee,
} from "../../lib/account-deletion";
import * as s from "../schema";

/**
 * How many unanswered refund requests the deletion page links to by name. The
 * count above it is exact; past this many the band finds the rest through each
 * event's "Reembolsos pedidos" filter.
 */
const UNANSWERED_REFUNDS_LISTED = 10;

/**
 * Unsettled fees named on the deletion page. One is enough to block; an unpaid
 * fee also stops the band opening another paid report, so more than a few is
 * unlikely.
 */
const UNSETTLED_FEES_LISTED = 10;

/** What deleting the account will take with it, counted for the band to read first. */
export type BandFootprint = {
  events: number;
  orders: number;
  tickets: number;
  /** Proofs whose image is still stored — older ones were already purged. */
  proofImages: number;
  members: number;
  accounts: number;
};

export type DeletionState = {
  footprint: BandFootprint;
  /** Every event, with its live tickets, for the deletion blockers. */
  events: { id: string; name: string; startsAt: string; liveTickets: number }[];
  /** Orders with a refund request nobody has answered: how many, and the first few. */
  unansweredRefunds: { count: number; orders: UnansweredRefund[] };
  /** Report fees Coverr has not accepted as paid. */
  unsettledFees: UnsettledFee[];
};

/**
 * Everything the delete-account page and its POST need, in one place.
 *
 * Read again on the POST rather than trusted from the page: a ticket sold, a
 * refund requested or a fee marked unpaid between the two must still stop the
 * deletion.
 */
export async function loadDeletionState(
  db: DrizzleD1Database<typeof s>,
  bandId: string,
): Promise<DeletionState> {
  const ofBand = eq(s.events.bandId, bandId);
  const count = sql<number>`count(*)`;

  const openRequest = and(ofBand, eq(s.refundRequests.status, "open"));

  const [
    events,
    liveByEvent,
    orders,
    tickets,
    proofImages,
    members,
    accounts,
    refundCount,
    refundOrders,
    unsettledFees,
  ] = await Promise.all([
    db
      .select({ id: s.events.id, name: s.events.name, startsAt: s.events.startsAt })
      .from(s.events)
      .where(ofBand),
    db
      .select({ eventId: s.orders.eventId, n: count })
      .from(s.attendees)
      .innerJoin(s.orders, eq(s.attendees.orderId, s.orders.id))
      .innerJoin(s.events, eq(s.orders.eventId, s.events.id))
      .where(and(ofBand, eq(s.orders.status, "confirmed"), isNull(s.attendees.voidedAt)))
      .groupBy(s.orders.eventId),
    db
      .select({ n: count })
      .from(s.orders)
      .innerJoin(s.events, eq(s.orders.eventId, s.events.id))
      .where(ofBand),
    db
      .select({ n: count })
      .from(s.attendees)
      .innerJoin(s.orders, eq(s.attendees.orderId, s.orders.id))
      .innerJoin(s.events, eq(s.orders.eventId, s.events.id))
      .where(ofBand),
    db
      .select({ n: count })
      .from(s.paymentProofs)
      .innerJoin(s.orders, eq(s.paymentProofs.orderId, s.orders.id))
      .innerJoin(s.events, eq(s.orders.eventId, s.events.id))
      .where(and(ofBand, isNull(s.paymentProofs.purgedAt))),
    db.select({ n: count }).from(s.bandMembers).where(eq(s.bandMembers.bandId, bandId)),
    db.select({ n: count }).from(s.bankAccounts).where(eq(s.bankAccounts.bandId, bandId)),
    db
      .select({ n: sql<number>`count(distinct ${s.orders.id})` })
      .from(s.refundRequests)
      .innerJoin(s.orders, eq(s.refundRequests.orderId, s.orders.id))
      .innerJoin(s.events, eq(s.orders.eventId, s.events.id))
      .where(openRequest),
    db
      .selectDistinct({
        eventSlug: s.events.slug,
        eventName: s.events.name,
        orderId: s.orders.id,
        shortCode: s.orders.shortCode,
      })
      .from(s.refundRequests)
      .innerJoin(s.orders, eq(s.refundRequests.orderId, s.orders.id))
      .innerJoin(s.events, eq(s.orders.eventId, s.events.id))
      .where(openRequest)
      .orderBy(s.events.name, s.orders.shortCode)
      .limit(UNANSWERED_REFUNDS_LISTED),
    db
      .select({
        eventName: s.events.name,
        amount: s.feePayments.amount,
        status: s.feePayments.status,
      })
      .from(s.feePayments)
      .innerJoin(s.eventUnlocks, eq(s.feePayments.unlockId, s.eventUnlocks.id))
      .innerJoin(s.events, eq(s.eventUnlocks.eventId, s.events.id))
      .where(
        and(
          eq(s.feePayments.bandId, bandId),
          inArray(s.feePayments.status, [...UNSETTLED_FEE_STATUSES]),
        ),
      )
      .orderBy(s.feePayments.uploadedAt)
      .limit(UNSETTLED_FEES_LISTED),
  ]);

  const liveTickets = new Map(liveByEvent.map((row) => [row.eventId, Number(row.n)]));
  const first = (rows: { n: number }[]) => Number(rows[0]?.n ?? 0);

  return {
    footprint: {
      events: events.length,
      orders: first(orders),
      tickets: first(tickets),
      proofImages: first(proofImages),
      members: first(members),
      accounts: first(accounts),
    },
    events: events.map((event) => ({ ...event, liveTickets: liveTickets.get(event.id) ?? 0 })),
    unansweredRefunds: { count: first(refundCount), orders: refundOrders },
    // The query filtered on exactly these statuses, so the narrowing holds.
    unsettledFees: unsettledFees as UnsettledFee[],
  };
}

/**
 * Deletes the band and, through the schema's ON DELETE CASCADE, everything
 * that hangs off it in the same statement: events, prices, expenses,
 * advances, orders, tickets, proof records, flags, refund requests,
 * unlocks, members, bank accounts and fan contacts.
 * `tests/schema-cascade.test.ts` holds every table to that.
 *
 * Then checks the cascade actually ran. D1 enforces foreign keys, but if a
 * database ever did not, this would leave every order behind without a
 * word — and "deletion really deletes" is the whole point. Throwing reaches
 * the operator through the crash alert.
 */
export async function deleteBandRows(
  db: DrizzleD1Database<typeof s>,
  bandId: string,
): Promise<void> {
  await db.delete(s.bands).where(eq(s.bands.id, bandId));

  const leftover = await db.get<{ remaining: number }>(sql`
    SELECT (SELECT count(*) FROM ${s.events} WHERE ${s.events.bandId} = ${bandId})
         + (SELECT count(*) FROM ${s.bandMembers} WHERE ${s.bandMembers.bandId} = ${bandId})
         + (SELECT count(*) FROM ${s.bankAccounts} WHERE ${s.bankAccounts.bandId} = ${bandId})
         + (SELECT count(*) FROM ${s.advances} WHERE ${s.advances.bandId} = ${bandId})
         + (SELECT count(*) FROM ${s.contacts} WHERE ${s.contacts.bandId} = ${bandId})
         + (SELECT count(*) FROM ${s.feePayments} WHERE ${s.feePayments.bandId} = ${bandId})
         + (SELECT count(*) FROM ${s.operatorActions} WHERE ${s.operatorActions.bandId} = ${bandId}) AS remaining`);
  const remaining = Number(leftover?.remaining ?? 0);
  if (remaining > 0) {
    throw new Error(
      `Deleted band ${bandId} but ${remaining} rows still reference it: the foreign-key cascade did not run`,
    );
  }
}
