import { drizzle } from "drizzle-orm/d1";
import { feeProofsPastRetention, markFeeProofsPurged } from "../db/queries/fees";
import * as s from "../db/schema";
import { nowIso } from "../lib/core";
import { feeProofPurgeable } from "../lib/fees";

type Env = { DB: D1Database; PROOFS: R2Bucket };

/**
 * Deletes fee screenshots 90 days after upload, nightly.
 *
 * Only for payments that stand: one flagged and unreviewed, or marked unpaid,
 * keeps its screenshot until an operator settles it, because that image is the
 * evidence. What was read off it stays in the row for good — the ledger needs
 * the amount and the reference, not a picture of somebody's bank app.
 *
 * Files go before rows, as in the buyers' purge: a failure leaves a row still
 * pointing at its file, and the next night tries again.
 */
export async function purgeExpiredFeeProofs(env: Env): Promise<{ purged: number }> {
  const db = drizzle(env.DB, { schema: s });
  const now = nowIso();
  const due = (await feeProofsPastRetention(db, now)).filter((row) =>
    feeProofPurgeable(row.status),
  );
  if (due.length === 0) return { purged: 0 };

  await env.PROOFS.delete(due.map((row) => row.fileKey as string));
  await markFeeProofsPurged(
    db,
    due.map((row) => row.id),
    now,
  );
  console.log(`[fee] purged ${due.length} fee screenshots past retention`);
  return { purged: due.length };
}
