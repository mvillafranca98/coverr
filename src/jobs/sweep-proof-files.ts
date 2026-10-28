import { drizzle } from "drizzle-orm/d1";
import { listEventStarts } from "../db/queries/events";
import * as s from "../db/schema";
import { proofsExpired } from "../lib/core";
import { deleteProofsForEvents } from "../lib/proof-storage";

type Env = {
  DB: D1Database;
  PROOFS: R2Bucket;
};

/**
 * Deletes every proof file left under an event whose retention has ended.
 *
 * `purge-proofs` works from rows: it finds proofs due for deletion and
 * removes their files. A file whose order was never saved has no row, so it
 * never came up — and the privacy policy promises every proof is gone 30
 * days after the event, not every proof that happens to have a row. This
 * works from the bucket instead: once an event is past retention, nothing
 * under its prefix should exist, so whatever is there goes.
 *
 * It runs beside the row purge rather than after it. If it removes a file
 * first, the row purge's own delete is a no-op and it still clears the
 * row's banking details and stamps `purged_at`.
 *
 * Every expired event is listed every night, deliberately. One list request
 * per event is cheap, and it means a file left by a failure months ago is
 * still found without anything having to remember it.
 */
export async function sweepExpiredProofFiles(env: Env): Promise<{ events: number; files: number }> {
  const db = drizzle(env.DB, { schema: s });
  const now = new Date();

  const expired = (await listEventStarts(db)).filter((event) => proofsExpired(event.startsAt, now));
  const files = await deleteProofsForEvents(
    env.PROOFS,
    expired.map((event) => event.id),
  );

  console.log(`[sweep] expired_events=${expired.length} proof_files_deleted=${files}`);
  return { events: expired.length, files };
}
