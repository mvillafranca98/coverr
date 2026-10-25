import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import * as s from "../../db/schema";
import { findEventWithBand } from "../../db/queries/events";
import {
  confirmedTicketCount,
  ticketsSoldUnderRule,
  uniqueShortCode,
} from "../../db/queries/orders";
import { findDuplicateProof, insertUnreadProof } from "../../db/queries/proofs";
import { resolveSellableRule } from "../../db/queries/price-rules";
import { readPurchaseForm } from "../../lib/purchase-form";
import { runVerification } from "../../jobs/verify-proof";
import { sendTickets } from "../../jobs/send-tickets";
import {
  newId,
  newQrToken,
  newShortCode,
  nowIso,
  purgeAfter,
  sha256Hex,
  normalizeEmail,
  normalizePhone,
} from "../../lib/core";
import type { PublicEnv } from "./context";
import { withinLimit, clientIp, TOO_MANY_REQUESTS } from "../../lib/rate-limit";

export const purchaseRoutes = new Hono<PublicEnv>();

/**
 * Turns a transfer the buyer already made into confirmed tickets.
 *
 * The order is written as `confirmed` and the QR codes exist the moment this
 * returns. Reading the proof and mailing the tickets both run after the
 * response: the buyer has their codes by then and nothing downstream can take
 * them away.
 */
purchaseRoutes.post("/e/:slug/comprar", async (c) => {
  const slug = c.req.param("slug");
  const db = drizzle(c.env.DB, { schema: s });
  const found = await findEventWithBand(db, slug);
  if (!found) return c.notFound();
  const { event, band } = found;

  const backToForm = (message: string, field?: string) =>
    c.redirect(
      `/e/${slug}?error=${encodeURIComponent(message)}` +
        (field ? `&campo=${encodeURIComponent(field)}` : ""),
      303,
    );

  // Every upload costs a vision call. This is the ceiling on that bill.
  if (!(await withinLimit(c.env.PURCHASE_LIMIT, `buy:${clientIp(c)}`))) {
    return backToForm(TOO_MANY_REQUESTS);
  }

  const form = readPurchaseForm(await c.req.parseBody());
  if (!form.ok) return backToForm(form.message, form.field);
  const {
    quantity,
    payerName,
    payerEmail,
    payerPhone,
    bankSelected,
    attendees,
    proof,
    shortCode: preferredShortCode,
  } = form.values;

  // Re-resolve the price server-side. The client tells us nothing about money.
  const rule = await resolveSellableRule(db, event.id);
  if (!rule) return backToForm("Ya no hay boletos disponibles.");
  const expectedAmount = rule.amount * quantity;

  // A rule's allocation is checked against the size of THIS order, not only
  // against what has already sold. `resolveSellableRule` marks a rule sold out
  // at `sold >= maxQty`, which lets one order walk straight through the limit:
  // 99 of a 100-ticket presale sold, a buyer takes ten, and 109 go at the
  // presale price. Refusing with the real number mirrors the capacity check
  // below and tells the buyer something they can act on.
  if (rule.maxQty != null) {
    const soldUnderRule = await ticketsSoldUnderRule(db, event.id, rule.id);
    if (soldUnderRule + quantity > rule.maxQty) {
      const left = Math.max(0, rule.maxQty - soldUnderRule);
      return backToForm(
        left === 0
          ? `Ya no quedan boletos en ${rule.label}.`
          : `Sólo quedan ${left} boletos en ${rule.label}.`,
        "quantity",
      );
    }
  }

  if (event.capacityCap != null) {
    const sold = await confirmedTicketCount(db, event.id);
    const left = Math.max(0, event.capacityCap - sold);
    // Saying how many are left beats "no hay cupo": a buyer wanting four when
    // three remain can act on the number, not just be refused.
    if (sold + quantity > event.capacityCap) {
      return backToForm(
        left === 0 ? "Ya no quedan boletos." : `Sólo quedan ${left} boletos.`,
        "quantity",
      );
    }
  }

  const bytes = await proof.arrayBuffer();
  const sha256 = await sha256Hex(bytes);

  const orderId = newId("ord");
  const ts = nowIso();
  const fileKey = `proofs/${event.id}/${orderId}`;

  await c.env.PROOFS.put(fileKey, bytes, {
    httpMetadata: { contentType: proof.type || "application/octet-stream" },
    customMetadata: { orderId, eventId: event.id, sha256 },
  });

  const shortCode = await uniqueShortCode(
    db,
    band.slug,
    preferredShortCode ?? newShortCode(band.slug),
  );
  const proofId = newId("prf");

  await db.insert(s.orders).values({
    id: orderId,
    eventId: event.id,
    shortCode,
    payerName,
    payerEmail: normalizeEmail(payerEmail),
    payerPhone: normalizePhone(payerPhone),
    quantity,
    priceRuleId: rule.id,
    expectedAmount,
    channel: "online",
    status: "confirmed",
    verificationStatus: "unmatched",
    bankSelected,
    soldBy: null,
    // Frozen at purchase: the buyer consented to this exact wording, so editing
    // the event later must not move the window under them.
    refundPolicy: event.refundPolicy,
    refundPolicyText: event.refundPolicyText,
    createdAt: ts,
  });
  await db.insert(s.attendees).values(
    attendees.map((attendee) => ({
      id: newId("att"),
      orderId,
      name: attendee.name,
      note: attendee.note,
      qrToken: newQrToken(),
      checkedInAt: null,
      checkedInBy: null,
      checkedInDevice: null,
    })),
  );
  await insertUnreadProof(db, {
    id: proofId,
    orderId,
    fileKey,
    contentType: proof.type || "application/octet-stream",
    fileSize: proof.size,
    sha256,
    uploadedAt: ts,
    purgeAfter: purgeAfter(event.startsAt),
  });

  // Deterministic check that needs no OCR. The QR is never withheld — a flag is
  // internal bookkeeping the admin sees and the door scanner surfaces as amber.
  const duplicate = await findDuplicateProof(db, sha256, orderId);
  if (duplicate) {
    await db.insert(s.verificationFlags).values({
      id: newId("flg"),
      orderId,
      proofId,
      code: "HASH_DUPLICATE",
      severity: "critical",
      detail: `Ese comprobante ya lo recibimos en la orden ${duplicate.orderShortCode ?? "anterior"}`,
      createdAt: ts,
      resolvedAt: null,
      resolvedBy: null,
      resolutionNote: null,
    });
    await db
      .update(s.orders)
      .set({ verificationStatus: "flagged" })
      .where(eq(s.orders.id, orderId));
  }

  // The buyer sees their QR codes on the next screen regardless — email is the
  // backup copy, so it must never delay or block the confirmation.
  c.executionCtx.waitUntil(sendTickets(c.env, orderId));
  // Reads the proof and raises flags. Runs after the response for the same
  // reason mail does: the buyer already has their QR codes and nothing here
  // can take them away.
  c.executionCtx.waitUntil(runVerification(c.env, orderId));

  return c.redirect(`/boletos/${orderId}`, 303);
});
