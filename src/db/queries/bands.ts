import { eq } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as s from "../schema";
import { slugify } from "../../lib/core";

/** The band behind the current session, or null if the row is gone. */
export async function findBand(db: DrizzleD1Database<typeof s>, bandId: string) {
  const rows = await db.select().from(s.bands).where(eq(s.bands.id, bandId)).limit(1);
  return rows[0] ?? null;
}

/** The band that signs in with this address. The contact email is unique. */
export async function findBandByEmail(db: DrizzleD1Database<typeof s>, email: string) {
  const rows = await db.select().from(s.bands).where(eq(s.bands.contactEmail, email)).limit(1);
  return rows[0] ?? null;
}

/**
 * Slug from the band name, with a numeric suffix when that one is taken.
 * Tries the first 40 candidates and otherwise returns the plain slug.
 */
export async function uniqueBandSlug(
  db: DrizzleD1Database<typeof s>,
  name: string,
): Promise<string> {
  const base = slugify(name);
  for (let attempt = 0; attempt < 40; attempt++) {
    const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`;
    const clash = await db
      .select({ id: s.bands.id })
      .from(s.bands)
      .where(eq(s.bands.slug, candidate))
      .limit(1);
    if (clash.length === 0) return candidate;
  }
  return base;
}
