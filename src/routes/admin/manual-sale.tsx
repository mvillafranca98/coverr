import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import * as s from "../../db/schema";
import { ManualSalePage } from "../../views/manual";
import { findBand } from "../../db/queries/bands";
import { findEventBySlug } from "../../db/queries/events";
import { currentPriceRule } from "../../db/queries/price-rules";
import { sendTickets } from "../../jobs/send-tickets";
import { newId, newQrToken, newShortCode, nowIso, lpsToCentavos } from "../../lib/core";
import type { AdminContext, AdminEnv } from "./context";

export const manualSaleRoutes = new Hono<AdminEnv>();

/** What the form shows after a successful sale, so the admin can open the QRs. */
type ManualSaleReceipt = {
  shortCode: string;
  quantity: number;
  amount: number;
  orderId: string;
};

const MAX_NAMES_PER_SALE = 40;

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

async function renderManualSale(
  c: AdminContext,
  opts: { error?: string; created?: ManualSaleReceipt } = {},
) {
  const db = drizzle(c.env.DB, { schema: s });
  const bandId = c.get("bandId");
  const slug = c.req.param("slug");
  const band = await findBand(db, bandId);
  const event = slug ? await findEventBySlug(db, bandId, slug) : null;
  if (!band || !event) return c.notFound();

  const rule = await currentPriceRule(db, event.id);

  return c.html(
    <ManualSalePage
      bandName={band.name}
      event={event}
      defaultPrice={rule?.amount ?? 0}
      priceLabel={rule?.label ?? "Taquilla"}
      created={opts.created ?? null}
      error={opts.error}
    />,
  );
}

manualSaleRoutes.get("/e/:slug/venta", (c) => renderManualSale(c));

manualSaleRoutes.post("/e/:slug/venta", async (c) => {
  const db = drizzle(c.env.DB, { schema: s });
  const bandId = c.get("bandId");
  const band = await findBand(db, bandId);
  const event = await findEventBySlug(db, bandId, c.req.param("slug"));
  if (!band || !event) return c.notFound();

  const body = await c.req.parseBody();
  const text = (key: string) =>
    typeof body[key] === "string" ? (body[key] as string).trim() : "";

  const names = text("names")
    .split("\n")
    .map((name) => name.trim())
    .filter(Boolean)
    .slice(0, MAX_NAMES_PER_SALE);
  if (names.length === 0) return renderManualSale(c, { error: "Poné al menos un nombre." });

  const unitPrice = lpsToCentavos(text("unit_price"));
  if (unitPrice == null) return renderManualSale(c, { error: "Revisá el monto." });

  const note = text("note");
  if (!note) {
    return renderManualSale(c, {
      error: "Escribí por qué — sin eso la orden no se explica después.",
    });
  }

  const payerEmail = text("payer_email");
  if (payerEmail && !EMAIL_PATTERN.test(payerEmail)) {
    return renderManualSale(c, { error: "Revisá el correo." });
  }

  const orderId = newId("ord");
  const shortCode = newShortCode(band.slug);
  const quantity = names.length;
  const createdAt = nowIso();

  // Zero-value goes in as a comp so it counts as attendance and never as
  // revenue; anything paid is its own `manual` channel, kept separate from the
  // door take so the cash drawer still reconciles on the night.
  const channel = unitPrice === 0 ? "comp" : "manual";

  await db.insert(s.orders).values({
    id: orderId,
    eventId: event.id,
    shortCode,
    payerName: text("payer_name") || names[0]!,
    payerEmail: payerEmail || `manual+${orderId}@local`,
    payerPhone: null,
    quantity,
    priceRuleId: null,
    expectedAmount: unitPrice * quantity,
    channel,
    status: "confirmed",
    verificationStatus: "manual_ok",
    bankSelected: null,
    soldBy: bandId,
    note,
    createdAt,
  });

  // Never checked in: nobody is at the door yet, so these scan like any other.
  await db.insert(s.attendees).values(
    names.map((name) => ({
      id: newId("att"),
      orderId,
      name,
      note,
      qrToken: newQrToken(),
      checkedInAt: null,
      checkedInBy: null,
      checkedInDevice: null,
    })),
  );

  if (payerEmail) c.executionCtx.waitUntil(sendTickets(c.env, orderId));

  return renderManualSale(c, {
    created: { shortCode, quantity, amount: unitPrice * quantity, orderId },
  });
});
