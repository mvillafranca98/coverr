import { and, desc, eq, isNotNull, isNull, ne, sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import type { PresaleTicket } from "../../lib/door-kit";
import { NOTE_ONLY_FLAG } from "../../lib/verify";
import * as s from "../schema";

/**
 * Every ticket the door should expect before it opens: live tickets on
 * confirmed orders, except cash sold at the door itself, with the first open
 * flag of each order. Comps are in it, since they walk in like anyone else.
 */
export async function presaleTickets(
  db: DrizzleD1Database<typeof s>,
  eventId: string,
): Promise<PresaleTicket[]> {
  const tickets = await db
    .select({
      orderId: s.orders.id,
      name: s.attendees.name,
      note: s.attendees.note,
      code: s.orders.shortCode,
      channel: s.orders.channel,
    })
    .from(s.attendees)
    .innerJoin(s.orders, eq(s.attendees.orderId, s.orders.id))
    .where(
      and(
        eq(s.orders.eventId, eventId),
        eq(s.orders.status, "confirmed"),
        isNull(s.attendees.voidedAt),
        ne(s.orders.channel, "door_cash"),
      ),
    );

  // What still needs a look, by order: the same rule the door uses.
  const flags = await db
    .select({ orderId: s.verificationFlags.orderId, code: s.verificationFlags.code })
    .from(s.verificationFlags)
    .innerJoin(s.orders, eq(s.verificationFlags.orderId, s.orders.id))
    .where(
      and(
        eq(s.orders.eventId, eventId),
        isNull(s.verificationFlags.resolvedAt),
        ne(s.verificationFlags.code, NOTE_ONLY_FLAG),
      ),
    );
  const flagByOrder = new Map<string, string>();
  for (const flag of flags)
    if (!flagByOrder.has(flag.orderId)) flagByOrder.set(flag.orderId, flag.code);

  return tickets.map((ticket) => ({
    ...ticket,
    flagCode: flagByOrder.get(ticket.orderId) ?? null,
  }));
}

/** The price a walk-up pays: the event's last price rule, as the door scanner reads it. */
export async function doorPrice(
  db: DrizzleD1Database<typeof s>,
  eventId: string,
): Promise<number | null> {
  const [rule] = await db
    .select({ amount: s.priceRules.amount })
    .from(s.priceRules)
    .where(eq(s.priceRules.eventId, eventId))
    .orderBy(sql`${s.priceRules.sortOrder} DESC`)
    .limit(1);
  return rule?.amount ?? null;
}

/** The names in the band's members table, for one set list per musician. */
export async function memberNames(
  db: DrizzleD1Database<typeof s>,
  bandId: string,
): Promise<string[]> {
  const rows = await db
    .select({ name: s.bandMembers.name })
    .from(s.bandMembers)
    .where(eq(s.bandMembers.bandId, bandId));
  return rows.map((row) => row.name);
}

/**
 * The set list the band wrote for its most recent other event, to start this
 * one from: bands mostly play the same set from one night to the next.
 */
export async function latestOtherSetlist(
  db: DrizzleD1Database<typeof s>,
  bandId: string,
  exceptEventId: string,
): Promise<string | null> {
  const [row] = await db
    .select({ setlist: s.events.setlist })
    .from(s.events)
    .where(
      and(
        eq(s.events.bandId, bandId),
        ne(s.events.id, exceptEventId),
        isNotNull(s.events.setlist),
        ne(s.events.setlist, ""),
      ),
    )
    .orderBy(desc(s.events.startsAt))
    .limit(1);
  return row?.setlist ?? null;
}

/** Saves an event's set list; an empty one is stored as none. */
export async function saveSetlist(
  db: DrizzleD1Database<typeof s>,
  eventId: string,
  setlist: string,
): Promise<void> {
  await db
    .update(s.events)
    .set({ setlist: setlist.trim() === "" ? null : setlist })
    .where(eq(s.events.id, eventId));
}
