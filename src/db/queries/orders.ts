import { and, desc, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { newShortCode } from "../../lib/core";
import { FLAGS_THAT_FREE_A_PLACE, NOTE_ONLY_FLAG } from "../../lib/verify";
import * as s from "../schema";

/**
 * One order with the event and band it belongs to — what every buyer-facing
 * page keyed by an order id needs, since the order id is the only thing the
 * buyer carries.
 */
export async function findOrderWithEventAndBand(db: DrizzleD1Database<typeof s>, orderId: string) {
  const rows = await db
    .select({ order: s.orders, event: s.events, band: s.bands })
    .from(s.orders)
    .innerJoin(s.events, eq(s.orders.eventId, s.events.id))
    .innerJoin(s.bands, eq(s.events.bandId, s.bands.id))
    .where(eq(s.orders.id, orderId))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * A ticket that occupies a place: live on a confirmed order, and on an order
 * with no open flag saying its upload is not a payment for it
 * (`FLAGS_THAT_FREE_A_PLACE`). A refunded ticket hands its place back, and so
 * does a junk upload once it has been read, so neither keeps real buyers out.
 *
 * Every count that decides what can still be sold goes through this one
 * condition — the event's capacity, a price's allocation, and which price is
 * on sale — so they can never disagree. Expects `attendees` joined to `orders`.
 */
export const holdsAPlace = and(
  eq(s.orders.status, "confirmed"),
  isNull(s.attendees.voidedAt),
  sql`not exists (select 1 from ${s.verificationFlags} where ${s.verificationFlags.orderId} = ${s.orders.id} and ${s.verificationFlags.resolvedAt} is null and ${inArray(s.verificationFlags.code, [...FLAGS_THAT_FREE_A_PLACE])})`,
);

/** Places already taken on an event, for the capacity check at purchase. */
export async function placesTaken(
  db: DrizzleD1Database<typeof s>,
  eventId: string,
): Promise<number> {
  const [taken] = await db
    .select({ n: sql<number>`count(*)` })
    .from(s.attendees)
    .innerJoin(s.orders, eq(s.attendees.orderId, s.orders.id))
    .where(and(eq(s.orders.eventId, eventId), holdsAPlace));
  return Number(taken?.n ?? 0);
}

/**
 * Places already taken under one price rule.
 *
 * Separate from `placesTaken` because a rule's allocation and the event's
 * capacity are different limits: a presale tier can sell out while the event
 * still has room, and only this count can tell you so.
 */
export async function placesTakenUnderRule(
  db: DrizzleD1Database<typeof s>,
  eventId: string,
  ruleId: string,
): Promise<number> {
  const [taken] = await db
    .select({ n: sql<number>`count(*)` })
    .from(s.attendees)
    .innerJoin(s.orders, eq(s.attendees.orderId, s.orders.id))
    .where(and(eq(s.orders.eventId, eventId), eq(s.orders.priceRuleId, ruleId), holdsAPlace));
  return Number(taken?.n ?? 0);
}

/**
 * A short code no other order is using, starting from the one the buyer may
 * have already pasted into the transfer's "Detalle".
 *
 * A collision regenerates rather than failing the sale: Detalle is a matching
 * hint, never authoritative, so a rare mismatch only degrades to matching on
 * name, amount and reference.
 */
export async function uniqueShortCode(
  db: DrizzleD1Database<typeof s>,
  bandSlug: string,
  preferred: string,
): Promise<string> {
  let shortCode = preferred;
  for (let attempt = 0; attempt < 5; attempt++) {
    const clash = await db
      .select({ id: s.orders.id })
      .from(s.orders)
      .where(eq(s.orders.shortCode, shortCode))
      .limit(1);
    if (clash.length === 0) break;
    shortCode = newShortCode(bandSlug);
  }
  return shortCode;
}

export type EventOrderRow = {
  id: string;
  shortCode: string;
  payerName: string;
  payerEmail: string;
  payerPhone: string | null;
  quantity: number;
  /** centavos per ticket as sold, so a total is never divided to find it. */
  unitAmount: number;
  expectedAmount: number;
  channel: string;
  status: string;
  verificationStatus: string;
  bankSelected: string | null;
  note: string | null;
  createdAt: string;
  /** Attendee names joined for display and search. */
  attendees: string;
  /** Live tickets already through the door. */
  checkedIn: number;
  /** Tickets refunded off this order. `quantity` minus these can still get in. */
  refundedTickets: number;
  /** The first unresolved flag's message, or null when the order is clean. */
  flag: string | null;
  hasOpenRefund: boolean;
};

/** One live order in a buyer's recovery email. */
export type RecoverableOrder = {
  orderId: string;
  shortCode: string;
  bandName: string;
  eventName: string;
  venue: string;
  startsAt: string;
  /** Tickets on the order that can still get in: refunded ones are left out. */
  tickets: number;
};

/**
 * The orders a buyer can still use, for `/recuperar`: confirmed, with at least
 * one live ticket, for events that have not yet passed `eventStartedAfter`,
 * soonest first.
 *
 * An address that has bought for years would otherwise get every past show
 * back too. Capped by `limit`, since one email has to hold them all. Start
 * times carry their own UTC offset, so they are compared through `julianday`.
 */
export async function recoverableOrdersForPayer(
  db: DrizzleD1Database<typeof s>,
  input: { payerEmail: string; eventStartedAfter: string; limit: number },
): Promise<RecoverableOrder[]> {
  const rows = await db
    .select({
      orderId: s.orders.id,
      shortCode: s.orders.shortCode,
      bandName: s.bands.name,
      eventName: s.events.name,
      venue: s.events.venue,
      startsAt: s.events.startsAt,
      tickets: sql<number>`count(*)`,
    })
    .from(s.orders)
    .innerJoin(s.events, eq(s.orders.eventId, s.events.id))
    .innerJoin(s.bands, eq(s.events.bandId, s.bands.id))
    .innerJoin(s.attendees, eq(s.attendees.orderId, s.orders.id))
    .where(
      and(
        eq(s.orders.payerEmail, input.payerEmail),
        eq(s.orders.status, "confirmed"),
        isNull(s.attendees.voidedAt),
        sql`julianday(${s.events.startsAt}) >= julianday(${input.eventStartedAfter})`,
      ),
    )
    .groupBy(s.orders.id)
    .orderBy(sql`julianday(${s.events.startsAt})`)
    .limit(input.limit);
  return rows.map((row) => ({ ...row, tickets: Number(row.tickets) }));
}

/**
 * One order, but only if it belongs to this event.
 *
 * The admin routes take an order id from the URL and an event slug from the
 * URL. Validating the slug proves the *event* is yours; it proves nothing
 * about the order. Every handler that mutates an order resolves it through
 * here first, so a band cannot pass its own slug with another band's order id
 * and act on a stranger's ticket.
 *
 * Returns null rather than throwing: the caller answers 404, which is also
 * what a genuinely missing order should look like.
 */
export async function findOrderInEvent(
  db: DrizzleD1Database<typeof s>,
  eventId: string,
  orderId: string,
) {
  const rows = await db
    .select()
    .from(s.orders)
    .where(and(eq(s.orders.id, orderId), eq(s.orders.eventId, eventId)))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Every order on an event, enriched with the three things the admin views
 * always need alongside it: who is on the tickets, how many walked in, and
 * whether anything is waiting on a human.
 *
 * Each join is on the event rather than on a list of order ids: an `inArray`
 * of every order blows D1's bound-parameter limit the moment an event sells
 * properly.
 */
export async function listOrdersForEvent(
  db: DrizzleD1Database<typeof s>,
  eventId: string,
): Promise<EventOrderRow[]> {
  return loadOrderRows(db, eventId);
}

/**
 * One order with exactly the enrichment the list gives it, without loading
 * the rest of the event to find it. Null when the order is not on this event,
 * which is also how an order id from another band's event looks.
 */
export async function findOrderRowInEvent(
  db: DrizzleD1Database<typeof s>,
  eventId: string,
  orderId: string,
): Promise<EventOrderRow | null> {
  const [row] = await loadOrderRows(db, eventId, orderId);
  return row ?? null;
}

/** The list and the single order, from the same queries narrowed by `orderId`. */
async function loadOrderRows(
  db: DrizzleD1Database<typeof s>,
  eventId: string,
  orderId?: string,
): Promise<EventOrderRow[]> {
  const inScope = orderId
    ? and(eq(s.orders.eventId, eventId), eq(s.orders.id, orderId))
    : eq(s.orders.eventId, eventId);

  const orders = await db
    .select({
      id: s.orders.id,
      shortCode: s.orders.shortCode,
      payerName: s.orders.payerName,
      payerEmail: s.orders.payerEmail,
      payerPhone: s.orders.payerPhone,
      quantity: s.orders.quantity,
      unitAmount: s.orders.unitAmount,
      expectedAmount: s.orders.expectedAmount,
      channel: s.orders.channel,
      status: s.orders.status,
      verificationStatus: s.orders.verificationStatus,
      bankSelected: s.orders.bankSelected,
      note: s.orders.note,
      createdAt: s.orders.createdAt,
    })
    .from(s.orders)
    .where(inScope)
    .orderBy(desc(s.orders.createdAt));

  const attendees = await db
    .select({
      orderId: s.attendees.orderId,
      name: s.attendees.name,
      checkedInAt: s.attendees.checkedInAt,
      voidedAt: s.attendees.voidedAt,
    })
    .from(s.attendees)
    .innerJoin(s.orders, eq(s.attendees.orderId, s.orders.id))
    .where(inScope);

  // What the list marks "revisar". A different sender name is a note on the
  // order page, not something to review, so it never marks an order here.
  const openFlags = await db
    .select({ orderId: s.verificationFlags.orderId, detail: s.verificationFlags.detail })
    .from(s.verificationFlags)
    .innerJoin(s.orders, eq(s.verificationFlags.orderId, s.orders.id))
    .where(
      and(
        inScope,
        isNull(s.verificationFlags.resolvedAt),
        ne(s.verificationFlags.code, NOTE_ONLY_FLAG),
      ),
    );

  const openRefunds = await db
    .select({ orderId: s.refundRequests.orderId })
    .from(s.refundRequests)
    .innerJoin(s.orders, eq(s.refundRequests.orderId, s.orders.id))
    .where(and(inScope, eq(s.refundRequests.status, "open")));

  const attendeesByOrder = new Map<
    string,
    { name: string; checkedInAt: string | null; voidedAt: string | null }[]
  >();
  for (const a of attendees) {
    const list = attendeesByOrder.get(a.orderId) ?? [];
    list.push({ name: a.name, checkedInAt: a.checkedInAt, voidedAt: a.voidedAt });
    attendeesByOrder.set(a.orderId, list);
  }

  const flagByOrder = new Map<string, string>();
  for (const f of openFlags) if (!flagByOrder.has(f.orderId)) flagByOrder.set(f.orderId, f.detail);

  const refundedOrderIds = new Set(openRefunds.map((r) => r.orderId));

  return orders.map((order) => {
    const list = attendeesByOrder.get(order.id) ?? [];
    return {
      ...order,
      attendees: list.map((a) => a.name).join(", "),
      checkedIn: list.filter((a) => a.checkedInAt && !a.voidedAt).length,
      refundedTickets: list.filter((a) => a.voidedAt).length,
      flag: flagByOrder.get(order.id) ?? null,
      hasOpenRefund: refundedOrderIds.has(order.id),
    };
  });
}
