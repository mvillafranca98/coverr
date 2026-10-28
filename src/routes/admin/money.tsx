import { and, eq, sql } from "drizzle-orm";
import { type DrizzleD1Database, drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import { findBand } from "../../db/queries/bands";
import { settlementFor } from "../../db/queries/event-totals";
import { findEventBySlug } from "../../db/queries/events";
import { readFlags } from "../../db/queries/flags";
import * as s from "../../db/schema";
import { newId, nowIso } from "../../lib/core";
import { priceBracket } from "../../lib/settlement";
import { TEXT_LIMITS, tooLong } from "../../lib/text-limits";
import { MoneyPage } from "../../views/admin/money";
import type { AdminEnv } from "./context";

export const moneyRoutes = new Hono<AdminEnv>();

const moneyPath = (slug: string) => `/admin/e/${slug}/dinero`;

/** The unlock fee is per gig, so the first one a band ever runs is free. */
async function isFirstEventForBand(db: DrizzleD1Database<typeof s>, bandId: string) {
  const [priorUnlocks] = await db
    .select({ n: sql<number>`count(*)` })
    .from(s.eventUnlocks)
    .innerJoin(s.events, eq(s.eventUnlocks.eventId, s.events.id))
    .where(eq(s.events.bandId, bandId));
  return Number(priorUnlocks?.n ?? 0) === 0;
}

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
      bracket={priceBracket(paidTickets)}
      isFirstEvent={await isFirstEventForBand(db, bandId)}
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

  const { counts } = await settlementFor(db, bandId, event.id);
  const isFirst = await isFirstEventForBand(db, bandId);
  const bracket = priceBracket(counts.sold - counts.comp);

  await db.insert(s.eventUnlocks).values({
    id: newId("unl"),
    eventId: event.id,
    bracket: isFirst ? "free_first" : bracket.bracket,
    amount: isFirst ? 0 : bracket.amount,
    paidAt: nowIso(),
    method: isFirst ? "free_first_event" : "pending_transfer",
    reference: null,
  });
  return c.redirect(moneyPath(event.slug), 303);
});
