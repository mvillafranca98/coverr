import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import { findBand } from "../../db/queries/bands";
import { findEventBySlug } from "../../db/queries/events";
import { findOrderInEvent, listOrdersForEvent } from "../../db/queries/orders";
import * as s from "../../db/schema";
import { runVerification } from "../../jobs/verify-proof";
import { newId, nowIso } from "../../lib/core";
import { safeProofDelivery } from "../../lib/file-type";
import { planTicketRefund } from "../../lib/refund-plan";
import { OrderPage } from "../../views/admin/order";
import type { AdminEnv } from "./context";

export const orderRoutes = new Hono<AdminEnv>();

const orderPath = (slug: string, orderId: string) => `/admin/e/${slug}/orden/${orderId}`;

orderRoutes.get("/e/:slug/orden/:id", async (c) => {
  const db = drizzle(c.env.DB, { schema: s });
  const bandId = c.get("bandId");
  const band = await findBand(db, bandId);
  const event = await findEventBySlug(db, bandId, c.req.param("slug"));
  if (!band || !event) return c.notFound();

  // Reuses the list query rather than a bespoke single-order one: the page
  // needs the same enrichment (attendee names, check-in count, open flag), and
  // an event tops out in the low hundreds of orders.
  const orders = await listOrdersForEvent(db, event.id);
  const order = orders.find((o) => o.id === c.req.param("id"));
  if (!order) return c.notFound();

  const [attendees, proofs, flags, refunds] = await Promise.all([
    db.select().from(s.attendees).where(eq(s.attendees.orderId, order.id)),
    db.select().from(s.paymentProofs).where(eq(s.paymentProofs.orderId, order.id)).limit(1),
    db.select().from(s.verificationFlags).where(eq(s.verificationFlags.orderId, order.id)),
    db
      .select()
      .from(s.refundRequests)
      .where(eq(s.refundRequests.orderId, order.id))
      .orderBy(desc(s.refundRequests.requestedAt))
      .limit(1),
  ]);

  return c.html(
    <OrderPage
      bandName={band.name}
      event={event}
      order={order}
      attendees={attendees}
      proof={proofs[0] ?? null}
      flags={flags}
      refund={refunds[0] ?? null}
      error={c.req.query("error") ?? undefined}
    />,
  );
});

/** Proofs are third-party banking details — served only behind a session. */
orderRoutes.get("/e/:slug/orden/:id/comprobante", async (c) => {
  const db = drizzle(c.env.DB, { schema: s });
  const event = await findEventBySlug(db, c.get("bandId"), c.req.param("slug"));
  if (!event) return c.notFound();

  const rows = await db
    .select({ proof: s.paymentProofs })
    .from(s.paymentProofs)
    .innerJoin(s.orders, eq(s.paymentProofs.orderId, s.orders.id))
    .where(and(eq(s.paymentProofs.orderId, c.req.param("id")), eq(s.orders.eventId, event.id)))
    .limit(1);
  const proof = rows[0]?.proof;
  if (!proof) return c.notFound();

  const object = await c.env.PROOFS.get(proof.fileKey);
  if (!object) return c.notFound();

  // Rows written before uploads were checked still hold whatever the uploader
  // declared, so the type is clamped on the way out too.
  const delivery = safeProofDelivery(proof.contentType);

  return c.body(object.body, 200, {
    "Content-Type": delivery.contentType,
    "Content-Disposition": delivery.disposition,
    "Cache-Control": "private, no-store",
  });
});

/** Clear one flag. With none left the order reads as checked by a human. */
orderRoutes.post("/e/:slug/orden/:id/resolver", async (c) => {
  const db = drizzle(c.env.DB, { schema: s });
  const bandId = c.get("bandId");
  const event = await findEventBySlug(db, bandId, c.req.param("slug"));
  if (!event) return c.notFound();

  // Prove the order is this event's before touching it — the slug only
  // proves the event is ours.
  const order = await findOrderInEvent(db, event.id, c.req.param("id"));
  if (!order) return c.notFound();

  const orderId = order.id;
  const flagId = String((await c.req.parseBody())["flag_id"] ?? "");

  await db
    .update(s.verificationFlags)
    .set({ resolvedAt: nowIso(), resolvedBy: bandId, resolutionNote: "Revisado desde el panel" })
    .where(and(eq(s.verificationFlags.id, flagId), eq(s.verificationFlags.orderId, orderId)));

  const [unresolved] = await db
    .select({ n: sql<number>`count(*)` })
    .from(s.verificationFlags)
    .where(and(eq(s.verificationFlags.orderId, orderId), isNull(s.verificationFlags.resolvedAt)));
  if (Number(unresolved?.n ?? 0) === 0) {
    await db
      .update(s.orders)
      .set({ verificationStatus: "manual_ok" })
      .where(and(eq(s.orders.id, orderId), eq(s.orders.eventId, event.id)));
  }
  return c.redirect(orderPath(event.slug, orderId), 303);
});

/** Re-run extraction — useful after a failed read or a fixed upload. */
orderRoutes.post("/e/:slug/orden/:id/revisar", async (c) => {
  const db = drizzle(c.env.DB, { schema: s });
  const event = await findEventBySlug(db, c.get("bandId"), c.req.param("slug"));
  if (!event) return c.notFound();

  const order = await findOrderInEvent(db, event.id, c.req.param("id"));
  if (!order) return c.notFound();

  // Deliberately no alert: the band pressed this button and is already
  // looking at the order it belongs to.
  await runVerification(c.env, order.id);
  return c.redirect(orderPath(event.slug, order.id), 303);
});

/** Renaming an attendee is the whole of "transfer this ticket to someone else". */
orderRoutes.post("/e/:slug/orden/:id/asistente", async (c) => {
  const db = drizzle(c.env.DB, { schema: s });
  const event = await findEventBySlug(db, c.get("bandId"), c.req.param("slug"));
  if (!event) return c.notFound();

  const order = await findOrderInEvent(db, event.id, c.req.param("id"));
  if (!order) return c.notFound();

  const orderId = order.id;
  const body = await c.req.parseBody();
  const attendeeId = String(body["attendee_id"] ?? "");
  const name = String(body["name"] ?? "").trim();

  if (name) {
    await db
      .update(s.attendees)
      .set({ name })
      .where(and(eq(s.attendees.id, attendeeId), eq(s.attendees.orderId, orderId)));
  }
  return c.redirect(orderPath(event.slug, orderId), 303);
});

orderRoutes.post("/e/:slug/orden/:id/anular", async (c) => {
  const db = drizzle(c.env.DB, { schema: s });
  const event = await findEventBySlug(db, c.get("bandId"), c.req.param("slug"));
  if (!event) return c.notFound();

  // Void rather than delete: the history stays, the QR stops scanning, and the
  // totals drop because every aggregate filters on status = 'confirmed'.
  await db
    .update(s.orders)
    .set({ status: "void" })
    .where(and(eq(s.orders.id, c.req.param("id")), eq(s.orders.eventId, event.id)));

  return c.redirect(`/admin/e/${event.slug}/ordenes`, 303);
});

/**
 * A refund the band starts itself.
 *
 * `/anular` beside this marks an order `void` — the ticket stops working and
 * the totals drop, which covers an order that should never have existed. It
 * says nothing about money and records no reason.
 *
 * This is the other case: the band is giving the money back. Until now that
 * could only begin on the buyer's own page, which `refundGate` closes 24 hours
 * after purchase — so a buyer who asked late could not be refunded, and a band
 * cancelling its gig had no way to record refunding anyone.
 *
 * Written as a request approved in the same breath rather than a second path
 * that mutates the order directly, so every refund in the system has one shape
 * and one audit trail, whoever started it.
 *
 * The money moves by bank transfer, outside Coverr, exactly as for an approved
 * buyer request. This records the decision, voids the QR codes and drops the
 * refunded tickets from the totals.
 *
 * Takes a ticket selection rather than always taking the whole order. Four
 * bought and two friends dropping out is the common case; before this the band
 * had to refund all four and have them buy two again at whatever the price is
 * now. Covering every live ticket still closes the order exactly as it used
 * to, so the ordinary full refund is unchanged.
 */
orderRoutes.post("/e/:slug/orden/:id/reembolsar", async (c) => {
  const db = drizzle(c.env.DB, { schema: s });
  const bandId = c.get("bandId");
  const event = await findEventBySlug(db, bandId, c.req.param("slug"));
  if (!event) return c.notFound();

  const order = await findOrderInEvent(db, event.id, c.req.param("id"));
  if (!order) return c.notFound();

  // Idempotent: a double submit, or a buyer's request approved in another tab
  // a moment earlier, must not write a second refund row.
  if (order.status !== "confirmed") return c.redirect(orderPath(event.slug, order.id), 303);

  const body = await c.req.parseBody({ all: true });
  const reason = String(body["motivo"] ?? "")
    .trim()
    .slice(0, 300);

  // parseBody collapses a single checked box to a string and several to an
  // array, so both shapes have to be read. An absent key means nothing was
  // ticked, which `planTicketRefund` refuses rather than reading as "all".
  const picked = body["boleto"];
  const selectedIds = (Array.isArray(picked) ? picked : picked == null ? [] : [picked]).map(String);

  const tickets = await db
    .select({ id: s.attendees.id, voidedAt: s.attendees.voidedAt })
    .from(s.attendees)
    .where(eq(s.attendees.orderId, order.id));

  const plan = planTicketRefund({ attendees: tickets, selectedIds });
  if (!plan.ok) {
    return c.redirect(
      `${orderPath(event.slug, order.id)}?error=${encodeURIComponent(plan.message)}`,
      303,
    );
  }

  const ts = nowIso();
  const scope = plan.voidsWholeOrder
    ? `los ${plan.voidIds.length} boletos`
    : `${plan.voidIds.length} de ${tickets.length} boletos`;

  await db.insert(s.refundRequests).values({
    id: newId("ref"),
    orderId: order.id,
    requestedAt: ts,
    reason: reason
      ? `Reembolso iniciado por la banda (${scope}): ${reason}`
      : `Reembolso iniciado por la banda (${scope}).`,
    status: "approved",
    ticketCount: plan.voidIds.length,
    handledBy: bandId,
    handledAt: ts,
  });

  await db.update(s.attendees).set({ voidedAt: ts }).where(inArray(s.attendees.id, plan.voidIds));

  // Only when nothing live is left. A partially refunded order stays
  // `confirmed` because the tickets still on it have to keep scanning.
  if (plan.voidsWholeOrder) {
    await db
      .update(s.orders)
      .set({ status: "refunded" })
      .where(and(eq(s.orders.id, order.id), eq(s.orders.eventId, event.id)));
  }

  return c.redirect(orderPath(event.slug, order.id), 303);
});

/**
 * Decide a refund. Approving marks the order `refunded`, which drops it from
 * every total and stops its QR codes scanning, because each aggregate and the
 * scanner manifest filter on status = 'confirmed'. The money itself moves in
 * the band's banking app — Coverr never held it.
 */
orderRoutes.post("/e/:slug/orden/:id/reembolso", async (c) => {
  const db = drizzle(c.env.DB, { schema: s });
  const bandId = c.get("bandId");
  const event = await findEventBySlug(db, bandId, c.req.param("slug"));
  if (!event) return c.notFound();

  const order = await findOrderInEvent(db, event.id, c.req.param("id"));
  if (!order) return c.notFound();

  const orderId = order.id;
  const decision = String((await c.req.parseBody())["decision"] ?? "");
  if (decision !== "approved" && decision !== "denied") {
    return c.redirect(orderPath(event.slug, orderId), 303);
  }

  await db
    .update(s.refundRequests)
    .set({ status: decision, handledBy: bandId, handledAt: nowIso() })
    .where(and(eq(s.refundRequests.orderId, orderId), eq(s.refundRequests.status, "open")));

  if (decision === "approved") {
    const ts = nowIso();

    // A buyer asks for the whole order back, so every ticket on it is stamped
    // too. The aggregates would drop it on order status alone, but leaving the
    // tickets unmarked would mean the same outcome had two shapes in the data,
    // and the order page would show a refunded order whose tickets each still
    // read as live.
    await db
      .update(s.attendees)
      .set({ voidedAt: ts })
      .where(and(eq(s.attendees.orderId, orderId), isNull(s.attendees.voidedAt)));

    await db
      .update(s.orders)
      .set({ status: "refunded" })
      .where(and(eq(s.orders.id, orderId), eq(s.orders.eventId, event.id)));
  }
  return c.redirect(orderPath(event.slug, orderId), 303);
});
