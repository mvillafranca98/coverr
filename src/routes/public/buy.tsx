import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { and, eq } from "drizzle-orm";
import * as s from "../../db/schema";
import { BuyPage } from "../../views/buy";
import { findEventWithBand } from "../../db/queries/events";
import { resolveSellableRule } from "../../db/queries/price-rules";
import { newShortCode } from "../../lib/core";
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

  if (event.status !== "live") {
    return c.html(
      `<!doctype html><meta charset=utf-8><body style="font-family:system-ui;background:#0C0B09;color:#F6F2EB;padding:40px;text-align:center">
       <h1>Esta venta no está abierta</h1><p style="color:#A79E90">Escribinos si creés que es un error.</p></body>`,
      404,
    );
  }

  // No sellable rule means sold out, and the page has to say so — there is no
  // price to fall back to.
  const rule = await resolveSellableRule(db, event.id);
  if (!rule) {
    return c.html(
      `<!doctype html><meta charset=utf-8><body style="font-family:system-ui;background:#0C0B09;color:#F6F2EB;padding:40px;text-align:center">
       <h1>Boletos agotados</h1><p style="color:#A79E90">Ya no hay boletos disponibles en línea.</p></body>`,
      410,
    );
  }

  const accounts = await db
    .select()
    .from(s.bankAccounts)
    .where(and(eq(s.bankAccounts.bandId, band.id), eq(s.bankAccounts.active, 1)))
    .orderBy(s.bankAccounts.sortOrder);
  if (accounts.length === 0) return c.text("Este evento no tiene cuenta bancaria configurada.", 500);

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
