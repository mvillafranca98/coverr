import { and, eq } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as s from "../schema";
import { slugify } from "../../lib/core";

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
