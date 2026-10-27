import { and, isNull, lte, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import * as s from "../db/schema";
import { nowIso } from "../lib/core";

type Env = {
  DB: D1Database;
  PROOFS: R2Bucket;
};

/**
 * One batch per run. A band's whole history is a few hundred proofs, so this
 * is never the limiting factor — the cap exists so a single invocation cannot
 * run long enough to be killed partway through and leave the work half done.
 */
const BATCH = 200;

/**
 * Deletes payment proofs that are past their retention window.
 *
 * The spec's rule is "proof files auto-delete 30 days after the event", and
 * the reason is specific: a `web_result` screenshot carries a **third party's**
 * full account number and sometimes their email. The payer is frequently not
 * the attendee, so this is somebody else's banking data sitting in a bucket.
 *
 * What goes, and what deliberately does not:
 *
 *  - The R2 object goes. It is the actual image and the whole risk.
 *  - `ocrRaw` and the four identity fields go — sender name and account,
 *    destination name and account. Those are the PII the spec names.
 *  - `sha256` stays, so HASH_DUPLICATE keeps working on a proof recycled from
 *    a gig two years ago. A hash identifies a file, not a person.
 *  - `xReference`, amount, currency, date and bank stay, so REF_DUPLICATE
 *    still catches a reused confirmation across events. A reference number
 *    with no name or account attached to it is not a person either.
 *
 * `purgedAt` is both the audit trail the spec asks for and the marker that
 * stops a row being reprocessed. Rows are kept rather than deleted because the
 * order still needs its verification history — "history is never deleted".
 */
export async function purgeExpiredProofs(env: Env): Promise<{ purged: number; failed: number }> {
  const db = drizzle(env.DB, { schema: s });
  const now = nowIso();

  const due = await db
    .select({ id: s.paymentProofs.id, fileKey: s.paymentProofs.fileKey })
    .from(s.paymentProofs)
    .where(and(lte(s.paymentProofs.purgeAfter, now), isNull(s.paymentProofs.purgedAt)))
    .limit(BATCH);

  if (due.length === 0) return { purged: 0, failed: 0 };

  let purged = 0;
  let failed = 0;

  for (const proof of due) {
    try {
      // R2 first. If this throws, the row keeps its null purgedAt and the next
      // run retries it — the opposite order would mark the file gone while it
      // is still sitting in the bucket.
      await env.PROOFS.delete(proof.fileKey);

      await db
        .update(s.paymentProofs)
        .set({
          purgedAt: now,
          ocrRaw: null,
          xSenderName: null,
          xSenderAccount: null,
          xDestAccount: null,
          xDestName: null,
        })
        .where(sql`${s.paymentProofs.id} = ${proof.id}`);

      purged += 1;
    } catch (err) {
      failed += 1;
      console.error(`[purge] could not purge proof=${proof.id}:`, err);
    }
  }

  console.log(
    `[purge] purged=${purged} failed=${failed} remaining_in_batch=${due.length - purged - failed}`,
  );
  return { purged, failed };
}
