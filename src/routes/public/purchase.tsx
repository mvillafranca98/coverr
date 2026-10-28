import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import { findEventWithBand } from "../../db/queries/events";
import { readFlags } from "../../db/queries/flags";
import {
  confirmedTicketCount,
  ticketsSoldUnderRule,
  uniqueShortCode,
} from "../../db/queries/orders";
import { resolveSellableRule } from "../../db/queries/price-rules";
import { findDuplicateProof, insertUnreadProof } from "../../db/queries/proofs";
import * as s from "../../db/schema";
import { notifyCriticalFlags } from "../../jobs/notify-flags";
import { sendTickets } from "../../jobs/send-tickets";
import { runVerification } from "../../jobs/verify-proof";
import {
  newId,
  newQrToken,
  newShortCode,
  normalizeEmail,
  normalizePhone,
  nowIso,
  purgeAfter,
  sha256Hex,
} from "../../lib/core";
import { proofObjectKey } from "../../lib/proof-storage";
import { checkProofBytes, readPurchaseForm } from "../../lib/purchase-form";
import { clientIp, TOO_MANY_REQUESTS, withinLimit } from "../../lib/rate-limit";
import type { PublicEnv } from "./context";

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

  // Checked on the server too: the buy page may have been loaded before the
  // switch was thrown, and this is the request that takes somebody's money.
  const flags = await readFlags(db);
  if (!flags.sales) {
    return backToForm("La venta está pausada ahora mismo. Volvé a intentarlo en un rato.");
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

  // The type comes from the bytes, never from what the browser declared. A
  // file that says image/png and holds HTML would otherwise be stored and
  // later served back into an admin session as a page. See lib/file-type.ts.
  const checked = checkProofBytes(bytes);
  if (!checked.ok) return backToForm(checked.message, checked.field);

  const sha256 = await sha256Hex(bytes);

  const orderId = newId("ord");
  const ts = nowIso();
  const fileKey = proofObjectKey(event.id, orderId);

  await c.env.PROOFS.put(fileKey, bytes, {
    httpMetadata: { contentType: checked.contentType },
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
    unitAmount: rule.amount,
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
    contentType: checked.contentType,
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
  // Verify, then alert. Composed here rather than nested inside the verifier
  // so the alert sees every unresolved critical flag on the order, including
  // the HASH_DUPLICATE raised above at upload — a recycled proof is the case
  // most worth hearing about, and the verifier never raises it.
  c.executionCtx.waitUntil(
    runVerification(c.env, orderId).then(() => notifyCriticalFlags(c.env, orderId)),
  );

  return c.redirect(`/boletos/${orderId}`, 303);
});
