import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import { findOrderWithEventAndBand } from "../../db/queries/orders";
import { openRefundRequest } from "../../db/queries/refunds";
import * as s from "../../db/schema";
import { newId, nowIso } from "../../lib/core";
import { makeTransport } from "../../lib/email";
import { clientIp, TOO_MANY_REQUESTS, withinLimit } from "../../lib/rate-limit";
import { refundGate } from "../../lib/refund-policy";
import {
  refundAlertEmailHtml,
  refundAlertEmailSubject,
  refundAlertEmailText,
} from "../../views/email";
import { RefundClosedPage, RefundRequestPage, RefundSentPage } from "../../views/refund";
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

  // It emails the band, so it shares the per-IP budget of everything else
  // that sends mail.
  if (!(await withinLimit(c.env.EMAIL_LIMIT, `mail:${clientIp(c)}`))) {
    return c.html(
      <RefundRequestPage
        {...common}
        policyText={order.refundPolicyText}
        error={TOO_MANY_REQUESTS}
      />,
      429,
    );
  }

  const reason = String((await c.req.parseBody())["reason"] ?? "")
    .trim()
    .slice(0, 2000);
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

  const created = await openRefundRequest(db, {
    id: newId("ref"),
    orderId: order.id,
    reason,
    requestedAt: nowIso(),
  });
  // Already asked: the buyer sees the same confirmation, and the band is not
  // told twice about one request.
  if (!created) return c.html(<RefundSentPage {...common} />);

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
        if (!result.ok)
          console.error(`[refund] alert failed for ${order.shortCode}: ${result.error}`);
      }),
  );

  return c.html(<RefundSentPage {...common} />);
});
