import { lt } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import * as s from "../db/schema";

type Env = {
  DB: D1Database;
};

/**
 * How long a crash record is worth keeping.
 *
 * Long enough to see a pattern across a season of gigs, short enough that a
 * bad week does not sit in the database forever. Cloudflare's own log
 * retention is far shorter, so this is the longer memory of the two.
 */
export const ERROR_RETENTION_DAYS = 90;

/**
 * Drops crash records past their retention window.
 *
 * Deleted rather than emptied, unlike payment proofs: an `error_log` row has
 * no history anyone needs and nothing references it. Keeping the rows forever
 * would mean one bad deploy permanently enlarging a table nobody reads.
 */
export async function purgeOldErrors(env: Env): Promise<{ deleted: number }> {
  const db = drizzle(env.DB, { schema: s });
  const cutoff = new Date(Date.now() - ERROR_RETENTION_DAYS * 86_400_000).toISOString();

  const result = await db.delete(s.errorLog).where(lt(s.errorLog.at, cutoff));
  const deleted = result.meta.changes ?? 0;

  if (deleted > 0) console.log(`[purge-errors] deleted=${deleted} older_than=${cutoff}`);
  return { deleted };
}
