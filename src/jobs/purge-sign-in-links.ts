import { drizzle } from "drizzle-orm/d1";
import { purgeExpiredSignInLinks } from "../db/queries/sign-in-links";
import * as s from "../db/schema";

type Env = {
  DB: D1Database;
};

/**
 * Forgets used sign-in links once they have expired. A spent link only has to
 * be remembered while it could still verify; after its 15 minutes it is
 * refused as expired before it is ever looked up, so the row is dead weight.
 */
export async function purgeSpentSignInLinks(env: Env): Promise<{ deleted: number }> {
  const db = drizzle(env.DB, { schema: s });
  const deleted = await purgeExpiredSignInLinks(db, new Date().toISOString());
  if (deleted > 0) console.log(`[purge-sign-in-links] deleted=${deleted}`);
  return { deleted };
}
