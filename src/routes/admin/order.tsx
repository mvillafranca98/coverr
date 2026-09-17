import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import * as s from "../../db/schema";
import { OrderPage } from "../../views/admin/order";
import { findBand } from "../../db/queries/bands";
import { findEventBySlug } from "../../db/queries/events";
import { listOrdersForEvent } from "../../db/queries/orders";
import { runVerification } from "../../jobs/verify-proof";
import { nowIso } from "../../lib/core";
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
    db
      .select()
      .from(s.paymentProofs)
      .where(eq(s.paymentProofs.orderId, order.id))
      .limit(1),
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

  return c.body(object.body, 200, {
    "Content-Type": proof.contentType,
    "Cache-Control": "private, no-store",
  });
});

/** Clear one flag. With none left the order reads as checked by a human. */
orderRoutes.post("/e/:slug/orden/:id/resolver", async (c) => {
  const db = drizzle(c.env.DB, { schema: s });
  const bandId = c.get("bandId");
  const event = await findEventBySlug(db, bandId, c.req.param("slug"));
  if (!event) return c.notFound();

  const orderId = c.req.param("id");
  const flagId = String((await c.req.parseBody())["flag_id"] ?? "");

  await db
    .update(s.verificationFlags)
    .set({ resolvedAt: nowIso(), resolvedBy: bandId, resolutionNote: "Revisado desde el panel" })
    .where(and(eq(s.verificationFlags.id, flagId), eq(s.verificationFlags.orderId, orderId)));

  const [unresolved] = await db
    .select({ n: sql<number>`count(*)` })
    .from(s.verificationFlags)
    .where(
      and(eq(s.verificationFlags.orderId, orderId), isNull(s.verificationFlags.resolvedAt)),
    );
  if (Number(unresolved?.n ?? 0) === 0) {
    await db
      .update(s.orders)
      .set({ verificationStatus: "manual_ok" })
      .where(eq(s.orders.id, orderId));
  }
  return c.redirect(orderPath(event.slug, orderId), 303);
});

/** Re-run extraction — useful after a failed read or a fixed upload. */
orderRoutes.post("/e/:slug/orden/:id/revisar", async (c) => {
  const db = drizzle(c.env.DB, { schema: s });
  const event = await findEventBySlug(db, c.get("bandId"), c.req.param("slug"));
  if (!event) return c.notFound();

  await runVerification(c.env, c.req.param("id"));
  return c.redirect(orderPath(event.slug, c.req.param("id")), 303);
});

/** Renaming an attendee is the whole of "transfer this ticket to someone else". */
orderRoutes.post("/e/:slug/orden/:id/asistente", async (c) => {
  const db = drizzle(c.env.DB, { schema: s });
  const event = await findEventBySlug(db, c.get("bandId"), c.req.param("slug"));
  if (!event) return c.notFound();

  const orderId = c.req.param("id");
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

  const orderId = c.req.param("id");
  const decision = String((await c.req.parseBody())["decision"] ?? "");
  if (decision !== "approved" && decision !== "denied") {
    return c.redirect(orderPath(event.slug, orderId), 303);
  }

  await db
    .update(s.refundRequests)
    .set({ status: decision, handledBy: bandId, handledAt: nowIso() })
    .where(and(eq(s.refundRequests.orderId, orderId), eq(s.refundRequests.status, "open")));

  if (decision === "approved") {
    await db
      .update(s.orders)
      .set({ status: "refunded" })
      .where(and(eq(s.orders.id, orderId), eq(s.orders.eventId, event.id)));
  }
  return c.redirect(orderPath(event.slug, orderId), 303);
});
