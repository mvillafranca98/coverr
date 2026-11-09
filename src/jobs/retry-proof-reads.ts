import { drizzle } from "drizzle-orm/d1";
import { readFlags } from "../db/queries/flags";
import { ordersWithUnreadProofs } from "../db/queries/proofs";
import * as s from "../db/schema";
import { notifyCriticalFlags } from "./notify-flags";
import { runVerification } from "./verify-proof";

type Env = {
  DB: D1Database;
  PROOFS: R2Bucket;
  ANTHROPIC_API_KEY?: string;
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
  APP_ORIGIN: string;
};

/**
 * Reads per run. Each one is a paid call that can take up to two 12-second
 * tries, so this bounds both the bill and how long one run lasts: an outage
 * that left a hundred proofs unread clears in five hours, not in one burst.
 */
const BATCH = 20;

/** An event stops being retried a day after it starts; by then the door is over. */
const RETRY_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Reads again, every hour, the proofs whose read never completed — the vision
 * call failed, timed out, or never ran because the switch was off or the job
 * was cut short.
 *
 * Each of those orders is amber at the door ("Todavía no se leyó"), which is
 * right while nobody has checked the receipt, but an outage at the API should
 * not still be asking staff to check receipts on the night. A read that
 * completes here replaces that flag exactly as the one at purchase would have.
 * The band is alerted only when this read is what found something critical:
 * a recycled file was already reported at purchase, and the free mail plan
 * has no room for the same alert twice.
 *
 * Does nothing while the proof_extraction switch is off or the key is missing:
 * those are deliberate, and the reads wait until they are undone.
 */
export async function retryUnreadProofs(env: Env): Promise<{ retried: number }> {
  if (!env.ANTHROPIC_API_KEY) return { retried: 0 };
  const db = drizzle(env.DB, { schema: s });
  if (!(await readFlags(db)).proof_extraction) return { retried: 0 };

  const orderIds = await ordersWithUnreadProofs(db, {
    eventStartedAfter: new Date(Date.now() - RETRY_WINDOW_MS).toISOString(),
    limit: BATCH,
  });

  // One at a time, like the reads at purchase: the batch is small, and running
  // them together would only make a rate limit at the API more likely.
  for (const orderId of orderIds) {
    const raised = await runVerification(env, orderId);
    if (raised.some((flag) => flag.severity === "critical")) {
      await notifyCriticalFlags(env, orderId);
    }
  }

  if (orderIds.length > 0) console.log(`[retry-proof-reads] retried=${orderIds.length}`);
  return { retried: orderIds.length };
}
