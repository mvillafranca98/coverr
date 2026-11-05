import { eq, lte } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as s from "../schema";

type Db = DrizzleD1Database<typeof s>;

/**
 * Records a sign-in link as used. True when this call spent it, false when it
 * was already spent — one insert against the primary key, so two taps racing
 * each other cannot both get in.
 */
export async function spendSignInLink(
  db: Db,
  link: { linkId: string; expiresAt: string },
  at: string,
): Promise<boolean> {
  const inserted = await db
    .insert(s.usedSignInLinks)
    .values({ id: link.linkId, usedAt: at, expiresAt: link.expiresAt })
    .onConflictDoNothing()
    .returning({ id: s.usedSignInLinks.id });
  return inserted.length > 0;
}

/** Whether a link was already used, to say so before anyone taps Entrar. */
export async function isSignInLinkSpent(db: Db, linkId: string): Promise<boolean> {
  const rows = await db
    .select({ id: s.usedSignInLinks.id })
    .from(s.usedSignInLinks)
    .where(eq(s.usedSignInLinks.id, linkId))
    .limit(1);
  return rows.length > 0;
}

/** Forgets links that have expired anyway: an expired link is refused before it is looked up. */
export async function purgeExpiredSignInLinks(db: Db, now: string): Promise<number> {
  const result = await db.delete(s.usedSignInLinks).where(lte(s.usedSignInLinks.expiresAt, now));
  return result.meta.changes ?? 0;
}
