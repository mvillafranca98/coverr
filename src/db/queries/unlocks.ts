import { eq, sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { type FreePass, type UnlockPrice, unlockPrice } from "../../lib/settlement";
import * as s from "../schema";

type Db = DrizzleD1Database<typeof s>;

/**
 * True when the band has never unlocked an event. Only half of whether an
 * unlock is free: the event also has to fall inside the offer, see
 * `isFreeFirstEvent`.
 */
export async function isBandsFirstUnlock(db: Db, bandId: string): Promise<boolean> {
  const [priorUnlocks] = await db
    .select({ n: sql<number>`count(*)` })
    .from(s.eventUnlocks)
    .innerJoin(s.events, eq(s.eventUnlocks.eventId, s.events.id))
    .where(eq(s.events.bandId, bandId));
  return Number(priorUnlocks?.n ?? 0) === 0;
}

/** The unlock that opened this event's report, if it has been opened. */
export async function unlockForEvent(db: Db, eventId: string) {
  const rows = await db
    .select()
    .from(s.eventUnlocks)
    .where(eq(s.eventUnlocks.eventId, eventId))
    .limit(1);
  return rows[0] ?? null;
}

/** The band's free pass as the price rules read it, or null when it holds none. */
function freePassOf(band: { freePassGrantedAt: string | null; freePassUntil: string | null }) {
  return band.freePassGrantedAt ? ({ until: band.freePassUntil } satisfies FreePass) : null;
}

/**
 * What this event's report costs the band right now: the one price the money
 * page shows and the unlock charges. `paidTickets` is tickets sold minus comps,
 * which the caller already has from the settlement.
 */
export async function priceToUnlock(
  db: Db,
  input: {
    band: { id: string; freePassGrantedAt: string | null; freePassUntil: string | null };
    event: { startsAt: string };
    paidTickets: number;
  },
): Promise<UnlockPrice> {
  return unlockPrice({
    paidTickets: input.paidTickets,
    bandsFirstUnlock: await isBandsFirstUnlock(db, input.band.id),
    eventStartsAt: input.event.startsAt,
    freePass: freePassOf(input.band),
  });
}
