import { and, eq, gt, sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { newId } from "../../lib/core";
import { type FreePass, type Promo, type UnlockPrice, unlockPrice } from "../../lib/settlement";
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

type PricedBand = {
  id: string;
  freePassGrantedAt: string | null;
  freePassUntil: string | null;
  promoGrantedAt: string | null;
  promoPercent: number | null;
  promoReportsLeft: number | null;
  promoUntil: string | null;
};

/** The band's free pass as the price rules read it, or null when it holds none. */
function freePassOf(band: PricedBand) {
  return band.freePassGrantedAt ? ({ until: band.freePassUntil } satisfies FreePass) : null;
}

/** The band's promo as the price rules read it, or null when it holds none. */
function promoOf(band: PricedBand): Promo | null {
  if (!band.promoGrantedAt || band.promoPercent === null || band.promoReportsLeft === null) {
    return null;
  }
  return { percent: band.promoPercent, reportsLeft: band.promoReportsLeft, until: band.promoUntil };
}

/**
 * Spends one report of the band's promo. Guarded in the statement itself, so
 * two unlocks at the same moment cannot both spend the last one — the second
 * finds nothing left and changes nothing.
 */
export function spendPromoUse(db: Db, bandId: string) {
  return db
    .update(s.bands)
    .set({ promoReportsLeft: sql`${s.bands.promoReportsLeft} - 1` })
    .where(and(eq(s.bands.id, bandId), gt(s.bands.promoReportsLeft, 0)));
}

/**
 * Unlocks a report that costs the band nothing — a free pass, the first-event
 * offer, a promo of 100% — spending the promo in the same batch if one priced it.
 */
export async function unlockWithoutCharge(
  db: Db,
  input: {
    bandId: string;
    eventId: string;
    bracket: string;
    method: string;
    discountPercent: number | null;
    at: string;
  },
) {
  const unlock = db.insert(s.eventUnlocks).values({
    id: newId("unl"),
    eventId: input.eventId,
    bracket: input.bracket,
    amount: 0,
    discountPercent: input.discountPercent,
    paidAt: input.at,
    method: input.method,
    reference: null,
  });
  if (input.discountPercent === null) await unlock;
  else await db.batch([unlock, spendPromoUse(db, input.bandId)]);
}

/**
 * What this event's report costs the band right now: the one price the money
 * page shows and the unlock charges. `paidTickets` is tickets sold minus comps,
 * which the caller already has from the settlement.
 */
export async function priceToUnlock(
  db: Db,
  input: {
    band: PricedBand;
    event: { startsAt: string };
    paidTickets: number;
  },
): Promise<UnlockPrice> {
  return unlockPrice({
    paidTickets: input.paidTickets,
    bandsFirstUnlock: await isBandsFirstUnlock(db, input.band.id),
    eventStartsAt: input.event.startsAt,
    freePass: freePassOf(input.band),
    promo: promoOf(input.band),
  });
}
