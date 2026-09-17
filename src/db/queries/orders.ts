import { and, desc, eq, isNull } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as s from "../schema";

export type EventOrderRow = {
  id: string;
  shortCode: string;
  payerName: string;
  payerEmail: string;
  payerPhone: string | null;
  quantity: number;
  expectedAmount: number;
  channel: string;
  status: string;
  verificationStatus: string;
  bankSelected: string | null;
  note: string | null;
  createdAt: string;
  /** Attendee names joined for display and search. */
  attendees: string;
  checkedIn: number;
  /** The first unresolved flag's message, or null when the order is clean. */
  flag: string | null;
  hasOpenRefund: boolean;
};

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
  const orders = await db
    .select({
      id: s.orders.id,
      shortCode: s.orders.shortCode,
      payerName: s.orders.payerName,
      payerEmail: s.orders.payerEmail,
      payerPhone: s.orders.payerPhone,
      quantity: s.orders.quantity,
      expectedAmount: s.orders.expectedAmount,
      channel: s.orders.channel,
      status: s.orders.status,
      verificationStatus: s.orders.verificationStatus,
      bankSelected: s.orders.bankSelected,
      note: s.orders.note,
      createdAt: s.orders.createdAt,
    })
    .from(s.orders)
    .where(eq(s.orders.eventId, eventId))
    .orderBy(desc(s.orders.createdAt));

  const attendees = await db
    .select({
      orderId: s.attendees.orderId,
      name: s.attendees.name,
      checkedInAt: s.attendees.checkedInAt,
    })
    .from(s.attendees)
    .innerJoin(s.orders, eq(s.attendees.orderId, s.orders.id))
    .where(eq(s.orders.eventId, eventId));

  const openFlags = await db
    .select({ orderId: s.verificationFlags.orderId, detail: s.verificationFlags.detail })
    .from(s.verificationFlags)
    .innerJoin(s.orders, eq(s.verificationFlags.orderId, s.orders.id))
    .where(and(eq(s.orders.eventId, eventId), isNull(s.verificationFlags.resolvedAt)));

  const openRefunds = await db
    .select({ orderId: s.refundRequests.orderId })
    .from(s.refundRequests)
    .innerJoin(s.orders, eq(s.refundRequests.orderId, s.orders.id))
    .where(and(eq(s.orders.eventId, eventId), eq(s.refundRequests.status, "open")));

  const attendeesByOrder = new Map<string, { name: string; checkedInAt: string | null }[]>();
  for (const a of attendees) {
    const list = attendeesByOrder.get(a.orderId) ?? [];
    list.push({ name: a.name, checkedInAt: a.checkedInAt });
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
      checkedIn: list.filter((a) => a.checkedInAt).length,
      flag: flagByOrder.get(order.id) ?? null,
      hasOpenRefund: refundedOrderIds.has(order.id),
    };
  });
}
