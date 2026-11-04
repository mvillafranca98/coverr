import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import { findBand } from "../../db/queries/bands";
import { settlementFor } from "../../db/queries/event-totals";
import { findEventBySlug } from "../../db/queries/events";
import { feeAccountForBand, unpaidFeeFor } from "../../db/queries/fees";
import { readFlags } from "../../db/queries/flags";
import { priceToUnlock, unlockForEvent } from "../../db/queries/unlocks";
import * as s from "../../db/schema";
import { bankLabel, newId, nowIso } from "../../lib/core";
import { TEXT_LIMITS, tooLong } from "../../lib/text-limits";
import { MoneyPage } from "../../views/admin/money";
import type { AdminEnv } from "./context";

export const moneyRoutes = new Hono<AdminEnv>();

const moneyPath = (slug: string) => `/admin/e/${slug}/dinero`;

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
  const unlock = await unlockForEvent(db, event.id);
  // Comps are free tickets; charging for them would be indefensible.
  const price = await priceToUnlock(db, { band, event, paidTickets: counts.sold - counts.comp });
  const account = price.waiver ? null : await feeAccountForBand(db, bandId);
  // Asked only when it could matter: a paid report still locked.
  const owed = price.waiver || unlock || !flags.billing ? null : await unpaidFeeFor(db, bandId);

  return c.html(
    <MoneyPage
      bandName={band.name}
      event={event}
      expenses={expenses}
      settlement={settlement}
      advancesByMember={advancesByMember}
      unlocked={!flags.billing || !!unlock}
      price={price}
      feeAccount={
        account
          ? {
              bank: bankLabel(account.bank),
              holderName: account.holderName,
              accountNumber: account.accountNumber,
            }
          : null
      }
      owed={owed}
      justPaid={c.req.query("pagado") === "1" && !!unlock}
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
