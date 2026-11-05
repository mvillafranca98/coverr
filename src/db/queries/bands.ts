import { and, asc, eq } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { newId, slugify } from "../../lib/core";
import * as s from "../schema";

/** The band behind the current session, or null if the row is gone. */
export async function findBand(db: DrizzleD1Database<typeof s>, bandId: string) {
  const rows = await db.select().from(s.bands).where(eq(s.bands.id, bandId)).limit(1);
  return rows[0] ?? null;
}

/**
 * Every band that signs in with this address, oldest first. One person may run
 * several; there is no cap, but a list this long is a person, not a crowd.
 */
export async function listBandsByEmail(db: DrizzleD1Database<typeof s>, email: string) {
  return db
    .select()
    .from(s.bands)
    .where(eq(s.bands.contactEmail, email))
    .orderBy(asc(s.bands.createdAt))
    .limit(50);
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

/**
 * A member, but only if they belong to this band.
 *
 * The advance form posts a member id. Validating it here is what stops a band
 * attaching an advance to a stranger's member and seeing that member's name
 * rendered back on its own settings page.
 */
export async function findBandMember(
  db: DrizzleD1Database<typeof s>,
  bandId: string,
  memberId: string,
) {
  const rows = await db
    .select()
    .from(s.bandMembers)
    .where(and(eq(s.bandMembers.id, memberId), eq(s.bandMembers.bandId, bandId)))
    .limit(1);
  return rows[0] ?? null;
}

/** An event by id, scoped to the band — the by-slug twin lives in events.ts. */
export async function findBandEventById(
  db: DrizzleD1Database<typeof s>,
  bandId: string,
  eventId: string,
) {
  const rows = await db
    .select({ id: s.events.id })
    .from(s.events)
    .where(and(eq(s.events.id, eventId), eq(s.events.bandId, bandId)))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Creates a band for `email` and returns its id. Only ever called once the
 * address has proved itself — by opening a creation link, or from a session
 * signed in through one — so nobody starts bands under someone else's email.
 */
export async function createBand(
  db: DrizzleD1Database<typeof s>,
  input: { name: string; email: string; at: string },
): Promise<string> {
  const id = newId("bnd");
  await db.insert(s.bands).values({
    id,
    name: input.name,
    slug: await uniqueBandSlug(db, input.name),
    contactEmail: input.email,
    createdAt: input.at,
  });
  return id;
}
