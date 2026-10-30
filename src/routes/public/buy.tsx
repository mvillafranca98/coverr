import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import { findEventWithBand } from "../../db/queries/events";
import { readFlags } from "../../db/queries/flags";
import { resolveSellableRule } from "../../db/queries/price-rules";
import * as s from "../../db/schema";
import { newShortCode } from "../../lib/core";
import { BuyPage } from "../../views/buy/page";
import { SaleNotOpenPage, SalesPausedPage, SoldOutPage } from "../../views/buy/unavailable";
import type { PublicEnv } from "./context";

export const buyRoutes = new Hono<PublicEnv>();

/**
 * The page a buyer lands on from the band's link: the price on sale right now,
 * where to transfer, and the form that turns a transfer into tickets.
 */
buyRoutes.get("/e/:slug", async (c) => {
  const db = drizzle(c.env.DB, { schema: s });
  const found = await findEventWithBand(db, c.req.param("slug"));
  if (!found) return c.notFound();
  const { event, band } = found;

  // The platform-wide stop. Shown here as well as enforced on the POST, so a
  // buyer is told before filling the form rather than after transferring.
  // A deliberate stop, not a fault: 503 rather than 404, because the sale
  // exists and is coming back.
  const flags = await readFlags(db);
  if (!flags.sales) return c.html(<SalesPausedPage band={band} event={event} />, 503);

  if (event.status !== "live") return c.html(<SaleNotOpenPage band={band} event={event} />, 404);

  // No sellable rule means sold out, and the page has to say so — there is no
  // price to fall back to.
  const rule = await resolveSellableRule(db, event.id);
  if (!rule) return c.html(<SoldOutPage band={band} event={event} />, 410);

  const accounts = await db
    .select()
    .from(s.bankAccounts)
    .where(and(eq(s.bankAccounts.bandId, band.id), eq(s.bankAccounts.active, 1)))
    .orderBy(s.bankAccounts.sortOrder);
  if (accounts.length === 0)
    return c.text("Este evento no tiene cuenta bancaria configurada.", 500);

  return c.html(
    <BuyPage
      band={band}
      event={event}
      rule={rule}
      accounts={accounts}
      shortCode={newShortCode(band.slug)}
      origin={c.env.APP_ORIGIN}
      error={c.req.query("error") ?? undefined}
    />,
  );
});
