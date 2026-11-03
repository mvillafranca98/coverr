import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import { findBand } from "../../db/queries/bands";
import { settlementFor } from "../../db/queries/event-totals";
import { findEventBySlug } from "../../db/queries/events";
import { feeAccountForBand, unlockByTransfer } from "../../db/queries/fees";
import { readFlags } from "../../db/queries/flags";
import { priceToUnlock, unlockForEvent, unlockWithoutCharge } from "../../db/queries/unlocks";
import * as s from "../../db/schema";
import { runFeeVerification } from "../../jobs/verify-fee";
import { newId, nowIso, sha256Hex } from "../../lib/core";
import { feeProofPurgeAfter, readFeeProofFile } from "../../lib/fees";
import { feeProofObjectKey, removeProofIfWriteFails } from "../../lib/proof-storage";
import { checkProofBytes } from "../../lib/purchase-form";
import { TOO_MANY_REQUESTS, withinLimit } from "../../lib/rate-limit";
import type { UnlockWaiver } from "../../lib/settlement";
import { CONTACT_EMAIL } from "../../views/legal/constants";
import type { AdminEnv } from "./context";

export const unlockRoutes = new Hono<AdminEnv>();

const moneyPath = (slug: string) => `/admin/e/${slug}/dinero`;

/** How a free unlock is recorded: the waiver stands in for the bracket. */
const WAIVED: Record<UnlockWaiver, { bracket: string; method: string }> = {
  free_pass: { bracket: "free_pass", method: "free_pass" },
  free_first: { bracket: "free_first", method: "free_first_event" },
  promo: { bracket: "promo", method: "promo" },
};

/**
 * Unlocks the settlement report for this event, priced off the ticket count
 * at the moment it fires — the show is over and the exact number is known, so
 * the band never picks a plan.
 *
 * A free report opens on the click. A charged one opens on the upload of the
 * transfer screenshot, the same rule a buyer gets: the band has its report on
 * this response, and the screenshot is read afterwards. A problem goes to an
 * operator, never back to a locked report.
 */
unlockRoutes.post("/e/:slug/dinero/desbloquear", async (c) => {
  const db = drizzle(c.env.DB, { schema: s });
  const bandId = c.get("bandId");
  const event = await findEventBySlug(db, bandId, c.req.param("slug"));
  if (!event) return c.notFound();
  const back = (error: string) =>
    c.redirect(`${moneyPath(event.slug)}?error=${encodeURIComponent(error)}`, 303);

  // Nothing to unlock while billing is off; the report is already showing.
  if (!(await readFlags(db)).billing) return c.redirect(moneyPath(event.slug), 303);
  if (await unlockForEvent(db, event.id)) return c.redirect(moneyPath(event.slug), 303);

  const band = await findBand(db, bandId);
  if (!band) return c.notFound();

  const { counts } = await settlementFor(db, bandId, event.id);
  const price = await priceToUnlock(db, { band, event, paidTickets: counts.sold - counts.comp });

  if (price.waiver) {
    await unlockWithoutCharge(db, {
      bandId,
      eventId: event.id,
      ...WAIVED[price.waiver],
      discountPercent: price.discountPercent,
      at: nowIso(),
    });
    return c.redirect(moneyPath(event.slug), 303);
  }

  // Each upload is a paid vision call, so it shares the re-read's ceiling.
  if (!(await withinLimit(c.env.EXTRACT_LIMIT, `fee:${bandId}`))) return back(TOO_MANY_REQUESTS);

  if (!(await feeAccountForBand(db, bandId))) {
    return back(`El cobro todavía no está listo. Escribinos a ${CONTACT_EMAIL}.`);
  }

  const proof = readFeeProofFile((await c.req.parseBody())["proof"]);
  if (!proof.ok) return back(proof.message);
  const bytes = await proof.file.arrayBuffer();
  const kind = checkProofBytes(bytes);
  if (!kind.ok) return back(kind.message);

  const feeId = newId("fee");
  const fileKey = feeProofObjectKey(bandId, feeId);
  const uploadedAt = new Date();
  const sha256 = await sha256Hex(bytes);
  await c.env.PROOFS.put(fileKey, bytes, { httpMetadata: { contentType: kind.contentType } });
  await removeProofIfWriteFails(c.env.PROOFS, fileKey, () =>
    unlockByTransfer(db, {
      bandId,
      eventId: event.id,
      bracket: price.bracket.bracket,
      amount: price.amount,
      discountPercent: price.discountPercent,
      fee: {
        id: feeId,
        fileKey,
        contentType: kind.contentType,
        fileSize: bytes.byteLength,
        sha256,
        uploadedAt: uploadedAt.toISOString(),
        purgeAfter: feeProofPurgeAfter(uploadedAt),
      },
    }),
  );

  c.executionCtx.waitUntil(runFeeVerification(c.env, feeId));
  return c.redirect(`${moneyPath(event.slug)}?pagado=1`, 303);
});
