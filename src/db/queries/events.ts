import { and, eq } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { slugify } from "../../lib/core";
import * as s from "../schema";

/**
 * Every event's id and start time, for the nightly proof-file sweep. Small by
 * nature — a band runs a few gigs a month — and read once a night.
 */
export async function listEventStarts(
  db: DrizzleD1Database<typeof s>,
): Promise<{ id: string; startsAt: string }[]> {
  return db.select({ id: s.events.id, startsAt: s.events.startsAt }).from(s.events);
}

/**
 * The event behind a public `/e/:slug` link, with the band that runs it.
 *
 * Deliberately not band-scoped: the buyer has no session, and the slug is the
 * public address of the event. Callers still have to check `status` before
 * selling anything.
 */
export async function findEventWithBand(db: DrizzleD1Database<typeof s>, slug: string) {
  const rows = await db
    .select({ event: s.events, band: s.bands })
    .from(s.events)
    .innerJoin(s.bands, eq(s.events.bandId, s.bands.id))
    .where(eq(s.events.slug, slug))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * The event a door-staff token opens, with its band. The token is the whole
 * credential for the scanner, so an unknown one must read as "no such event".
 */
export async function findEventByStaffToken(db: DrizzleD1Database<typeof s>, token: string) {
  const rows = await db
    .select({ event: s.events, band: s.bands })
    .from(s.events)
    .innerJoin(s.bands, eq(s.events.bandId, s.bands.id))
    .where(eq(s.events.staffToken, token))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Always scoped to the band. Slugs are globally unique, so looking one up
 * without the band id would let a session read another band's event.
 */
export async function findEventBySlug(
  db: DrizzleD1Database<typeof s>,
  bandId: string,
  slug: string,
) {
  const rows = await db
    .select()
    .from(s.events)
    .where(and(eq(s.events.slug, slug), eq(s.events.bandId, bandId)))
    .limit(1);
  return rows[0] ?? null;
}

/** Slug from the event name, with a numeric suffix if that one is taken. */
export async function uniqueEventSlug(
  db: DrizzleD1Database<typeof s>,
  name: string,
): Promise<string> {
  const base = slugify(name);
  for (let attempt = 0; attempt < 40; attempt++) {
    const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`;
    const taken = await db
      .select({ id: s.events.id })
      .from(s.events)
      .where(eq(s.events.slug, candidate))
      .limit(1);
    if (taken.length === 0) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}
