import { and, eq, sql } from "drizzle-orm";
import { type DrizzleD1Database, drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import { findBand } from "../../db/queries/bands";
import { settlementFor } from "../../db/queries/event-totals";
import { findEventBySlug } from "../../db/queries/events";
import { readFlags } from "../../db/queries/flags";
import * as s from "../../db/schema";
import { newId, nowIso } from "../../lib/core";
import { type FreePass, type UnlockWaiver, unlockPrice } from "../../lib/settlement";
import { TEXT_LIMITS, tooLong } from "../../lib/text-limits";
import { MoneyPage } from "../../views/admin/money";
import type { AdminEnv } from "./context";

export const moneyRoutes = new Hono<AdminEnv>();

const moneyPath = (slug: string) => `/admin/e/${slug}/dinero`;

/**
 * True when the band has never unlocked an event. Only half of whether this
 * unlock is free: the event also has to fall inside the offer, see
 * `isFreeFirstEvent`.
 */
async function isBandsFirstUnlock(db: DrizzleD1Database<typeof s>, bandId: string) {
  const [priorUnlocks] = await db
    .select({ n: sql<number>`count(*)` })
    .from(s.eventUnlocks)
    .innerJoin(s.events, eq(s.eventUnlocks.eventId, s.events.id))
    .where(eq(s.events.bandId, bandId));
  return Number(priorUnlocks?.n ?? 0) === 0;
}

/** The band's free pass as the price rules read it, or null when it holds none. */
function freePassOf(band: { freePassGrantedAt: string | null; freePassUntil: string | null }) {
  return band.freePassGrantedAt ? ({ until: band.freePassUntil } satisfies FreePass) : null;
}

/** How each kind of unlock is recorded: what it was priced at and why. */
const UNLOCK_RECORD: Record<UnlockWaiver | "charged", { bracket?: string; method: string }> = {
  free_pass: { bracket: "free_pass", method: "free_pass" },
  free_first: { bracket: "free_first", method: "free_first_event" },
  charged: { method: "pending_transfer" },
};

moneyRoutes.get("/e/:slug/dinero", async (c) => {
  const db = drizzle(c.env.DB, { schema: s });
  const bandId = c.get("bandId");
  const band = await findBand(db, bandId);
  const event = await findEventBySlug(db, bandId, c.req.param("slug"));
  if (!band || !event) return c.notFound();

  const { settlement, advancesByMember, counts } = await settlementFor(db, bandId, event.id);

  const expenses = await db
    .select()
    .from(s.expenses)
    .where(eq(s.expenses.eventId, event.id))
    .orderBy(s.expenses.createdAt);

  const flags = await readFlags(db);

  const unlock = await db
    .select()
    .from(s.eventUnlocks)
    .where(eq(s.eventUnlocks.eventId, event.id))
    .limit(1);

  // Comps are free tickets; charging for them would be indefensible.
  const paidTickets = counts.sold - counts.comp;

  return c.html(
    <MoneyPage
      bandName={band.name}
      event={event}
      expenses={expenses}
      settlement={settlement}
      advancesByMember={advancesByMember}
      unlocked={!flags.billing || !!unlock[0]}
      price={unlockPrice({
        paidTickets,
        bandsFirstUnlock: await isBandsFirstUnlock(db, bandId),
        eventStartsAt: event.startsAt,
        freePass: freePassOf(band),
      })}
      error={c.req.query("error") ?? undefined}
    />,
  );
});

moneyRoutes.post("/e/:slug/dinero/costo", async (c) => {
  const db = drizzle(c.env.DB, { schema: s });
  const event = await findEventBySlug(db, c.get("bandId"), c.req.param("slug"));
  if (!event) return c.notFound();

  const body = await c.req.parseBody();
  const label = String(body["label"] ?? "").trim();
  const category = String(body["category"] ?? "other");
  const lempiras = Number(body["amount"]);

  const labelError = tooLong(label, TEXT_LIMITS.expenseLabel, "La descripción del gasto");
  if (labelError) {
    return c.redirect(`${moneyPath(event.slug)}?error=${encodeURIComponent(labelError)}`, 303);
  }

  if (label && Number.isFinite(lempiras) && lempiras >= 0) {
    await db.insert(s.expenses).values({
      id: newId("exp"),
      eventId: event.id,
      label,
      category,
      amount: Math.round(lempiras * 100), // centavos, always
      note: null,
      paid: 0,
      createdAt: nowIso(),
    });
  }
  return c.redirect(moneyPath(event.slug), 303);
});

moneyRoutes.post("/e/:slug/dinero/costo/borrar", async (c) => {
  const db = drizzle(c.env.DB, { schema: s });
  const event = await findEventBySlug(db, c.get("bandId"), c.req.param("slug"));
  if (!event) return c.notFound();

  const expenseId = String((await c.req.parseBody())["id"] ?? "");
  await db
    .delete(s.expenses)
    .where(and(eq(s.expenses.id, expenseId), eq(s.expenses.eventId, event.id)));

  return c.redirect(moneyPath(event.slug), 303);
});

/**
 * Unlock the settlement report for this event. Priced off the ticket count at
 * the moment it fires, which is why the band never picks a plan: the show is
 * over and the exact number is already known.
 */
moneyRoutes.post("/e/:slug/dinero/desbloquear", async (c) => {
  const db = drizzle(c.env.DB, { schema: s });
  const bandId = c.get("bandId");
  const event = await findEventBySlug(db, bandId, c.req.param("slug"));
  if (!event) return c.notFound();

  // Nothing to unlock while billing is off; the report is already showing.
  if (!(await readFlags(db)).billing) return c.redirect(moneyPath(event.slug), 303);

  const existing = await db
    .select()
    .from(s.eventUnlocks)
    .where(eq(s.eventUnlocks.eventId, event.id))
    .limit(1);
  if (existing[0]) return c.redirect(moneyPath(event.slug), 303);

  const band = await findBand(db, bandId);
  if (!band) return c.notFound();

  const { counts } = await settlementFor(db, bandId, event.id);
  const price = unlockPrice({
    paidTickets: counts.sold - counts.comp,
    bandsFirstUnlock: await isBandsFirstUnlock(db, bandId),
    eventStartsAt: event.startsAt,
    freePass: freePassOf(band),
  });
  const record = UNLOCK_RECORD[price.waiver ?? "charged"];

  await db.insert(s.eventUnlocks).values({
    id: newId("unl"),
    eventId: event.id,
    bracket: record.bracket ?? price.bracket.bracket,
    amount: price.amount,
    paidAt: nowIso(),
    method: record.method,
    reference: null,
  });
  return c.redirect(moneyPath(event.slug), 303);
});
