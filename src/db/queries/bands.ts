import { eq } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as s from "../schema";

/** The band behind the current session, or null if the row is gone. */
export async function findBand(db: DrizzleD1Database<typeof s>, bandId: string) {
  const rows = await db.select().from(s.bands).where(eq(s.bands.id, bandId)).limit(1);
  return rows[0] ?? null;
}
