import type { DrizzleD1Database } from "drizzle-orm/d1";
import { FLAG_DEFAULTS, type Flags, resolveFlags } from "../../lib/flags";
import * as s from "../schema";

/**
 * Reads the platform switches.
 *
 * Deliberately fails open. If this query throws, the defaults apply — which
 * means sales keep working. A flag store that could stop a gig by being
 * unreachable would be a worse liability than the thing it was meant to stop,
 * so the only way to halt sales is a row somebody wrote on purpose.
 *
 * The table holds three rows at most, so this is a cheap read on a hot path.
 */
export async function readFlags(db: DrizzleD1Database<typeof s>): Promise<Flags> {
  try {
    const rows = await db
      .select({ key: s.platformFlags.key, enabled: s.platformFlags.enabled })
      .from(s.platformFlags);
    return resolveFlags(rows);
  } catch (err) {
    console.error(`[flags] unreadable, falling back to defaults: ${String(err)}`);
    return { ...FLAG_DEFAULTS };
  }
}
