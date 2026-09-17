import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { and, eq } from "drizzle-orm";
import * as s from "../../db/schema";
import { RefundRequestPage, RefundSentPage, RefundClosedPage } from "../../views/refund";
import {
  refundAlertEmailHtml,
  refundAlertEmailText,
  refundAlertEmailSubject,
} from "../../views/email";
import { findOrderWithEventAndBand } from "../../db/queries/orders";
import { refundGate } from "../../lib/refund-policy";
import { makeTransport } from "../../lib/email";
import { newId, nowIso } from "../../lib/core";
import type { PublicEnv } from "./context";

export const refundRoutes = new Hono<PublicEnv>();

/**
 * Asking for a refund. The band moves the money itself — Coverr never holds
 * it — so all this flow does is record the request and make sure the band
 * hears about it.
 */
refundRoutes.get("/reembolso/:orderId", async (c) => {
  const db = drizzle(c.env.DB, { schema: s });
  const found = await findOrderWithEventAndBand(db, c.req.param("orderId"));
  if (!found) return c.notFound();
  const { order, event, band } = found;
  const common = { band, event, order };

  const existing = await db
    .select()
    .from(s.refundRequests)
    .where(and(eq(s.refundRequests.orderId, order.id), eq(s.refundRequests.status, "open")))
    .limit(1);
  if (existing[0]) return c.html(<RefundSentPage {...common} />);

  const gate = refundGate(order);
  if (!gate.open) {
    return c.html(<RefundClosedPage {...common} headline={gate.headline} detail={gate.detail} />);
  }
  return c.html(<RefundRequestPage {...common} policyText={order.refundPolicyText} />);
});

refundRoutes.post("/reembolso/:orderId", async (c) => {
  const db = drizzle(c.env.DB, { schema: s });
  const found = await findOrderWithEventAndBand(db, c.req.param("orderId"));
  if (!found) return c.notFound();
  const { order, event, band } = found;
  const common = { band, event, order };

  const gate = refundGate(order);
  if (!gate.open) {
    return c.html(<RefundClosedPage {...common} headline={gate.headline} detail={gate.detail} />);
  }

  const reason = String((await c.req.parseBody())["reason"] ?? "").trim().slice(0, 2000);
  if (!reason) {
    return c.html(
      <RefundRequestPage
        {...common}
        policyText={order.refundPolicyText}
        error="Contanos brevemente por qué."
      />,
      400,
    );
  }

  await db.insert(s.refundRequests).values({
    id: newId("ref"),
    orderId: order.id,
    requestedAt: nowIso(),
    reason,
    status: "open",
    handledBy: null,
    handledAt: null,
  });

  // The band decides and moves the money themselves; this just makes sure they
  // hear about it rather than finding it in the dashboard days later.
  const mail = { event, order, reason, origin: c.env.APP_ORIGIN };
  c.executionCtx.waitUntil(
    makeTransport(c.env)
      .send({
        to: band.contactEmail,
        replyTo: order.payerEmail,
        subject: refundAlertEmailSubject(mail),
        html: refundAlertEmailHtml(mail),
        text: refundAlertEmailText(mail),
      })
      .then((result) => {
        if (!result.ok) console.error(`[refund] alert failed for ${order.shortCode}: ${result.error}`);
      }),
  );

  return c.html(<RefundSentPage {...common} />);
});
