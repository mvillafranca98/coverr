import { and, eq, inArray, isNull } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import type { CheckInClaim, TicketState } from "../../lib/check-in";
import * as s from "../schema";

/**
 * Tokens per read. D1 binds at most 100 parameters to one query, and the
 * event id takes one of them.
 */
const TOKENS_PER_QUERY = 90;

/**
 * The tickets on this event behind the given QR tokens, by token. A token
 * from another event, or none at all, is simply absent.
 *
 * A few reads for a whole sync rather than one per scan: a Worker may run at
 * most 1,000 D1 queries per request, and a 500-scan sync used to need up to
 * 1,002, failing partway through.
 */
export async function ticketsByToken(
  db: DrizzleD1Database<typeof s>,
  eventId: string,
  tokens: string[],
): Promise<Map<string, TicketState>> {
  const tickets = new Map<string, TicketState>();
  for (let start = 0; start < tokens.length; start += TOKENS_PER_QUERY) {
    const rows = await db
      .select({
        token: s.attendees.qrToken,
        id: s.attendees.id,
        checkedInAt: s.attendees.checkedInAt,
        checkedInDevice: s.attendees.checkedInDevice,
        voidedAt: s.attendees.voidedAt,
        orderStatus: s.orders.status,
      })
      .from(s.attendees)
      .innerJoin(s.orders, eq(s.attendees.orderId, s.orders.id))
      .where(
        and(
          eq(s.orders.eventId, eventId),
          inArray(s.attendees.qrToken, tokens.slice(start, start + TOKENS_PER_QUERY)),
        ),
      );
    for (const { token, ...ticket } of rows) tickets.set(token, ticket);
  }
  return tickets;
}

/**
 * Writes a sync's check-ins in one batch and returns the ids actually let in.
 *
 * Each write lets a ticket in only while it is still outside. Without that
 * condition, two devices syncing the same ticket at once were both told "ok"
 * and the second overwrote the first: a cross-device double scan nobody saw.
 */
export async function checkInTickets(
  db: DrizzleD1Database<typeof s>,
  claims: CheckInClaim[],
): Promise<Set<string>> {
  const writes = claims.map((claim) =>
    db
      .update(s.attendees)
      .set({ checkedInAt: claim.at, checkedInDevice: claim.device })
      .where(and(eq(s.attendees.id, claim.attendeeId), isNull(s.attendees.checkedInAt)))
      .returning({ id: s.attendees.id }),
  );
  const [first, ...rest] = writes;
  if (!first) return new Set();
  const written = await db.batch([first, ...rest]);
  return new Set(written.flat().map((row) => row.id));
}
