import { desc, eq } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { newId } from "../../lib/core";
import * as s from "../schema";

/**
 * The operator panel's reads and writes: every band at a glance, one band in
 * full, and the four changes the operator can make to a band's standing.
 *
 * The roll-ups are raw D1 SQL, like the band home's: one query per page with a
 * subquery per figure, never one query per band. A paid ticket is counted the
 * way the settlement report counts it — a live ticket on a confirmed order,
 * comps left out — so the two can never disagree about a band.
 */

const PAID_TICKET = `o.status = 'confirmed' AND o.channel <> 'comp' AND a.voided_at IS NULL`;

export type OperatorBandRow = {
  id: string;
  name: string;
  contactEmail: string;
  createdAt: string;
  bannedAt: string | null;
  freePassGrantedAt: string | null;
  freePassUntil: string | null;
  events: number;
  paidTickets: number;
  /** The newest of the band's signup, its events and its orders. */
  lastActivity: string;
  reportsUnlocked: number;
  /** Centavos recorded on its unlocks. Not money received: paying comes with the fee page. */
  feesCharged: number;
};

/** `%` and `_` typed into the search box are letters, not wildcards. */
function likePattern(search: string): string {
  return `%${search.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

/** One page of every band, newest first, optionally narrowed by name or email. */
export async function listBands(
  db: D1Database,
  options: { search: string; limit: number; offset: number },
): Promise<{ rows: OperatorBandRow[]; total: number }> {
  const filter = `(?1 = '' OR b.name LIKE ?2 ESCAPE '\\' OR b.contact_email LIKE ?2 ESCAPE '\\')`;
  const pattern = likePattern(options.search);

  const [page, count] = await db.batch([
    db
      .prepare(
        `SELECT b.id, b.name, b.contact_email, b.created_at, b.banned_at,
                b.free_pass_granted_at, b.free_pass_until,
                (SELECT COUNT(*) FROM events e WHERE e.band_id = b.id) AS events,
                (SELECT COUNT(*) FROM attendees a
                   JOIN orders o ON o.id = a.order_id
                   JOIN events e ON e.id = o.event_id
                  WHERE e.band_id = b.id AND ${PAID_TICKET}) AS paid_tickets,
                MAX(b.created_at,
                    COALESCE((SELECT MAX(e.created_at) FROM events e WHERE e.band_id = b.id), ''),
                    COALESCE((SELECT MAX(o.created_at) FROM orders o
                                JOIN events e ON e.id = o.event_id
                               WHERE e.band_id = b.id), '')) AS last_activity,
                (SELECT COUNT(*) FROM event_unlocks u
                   JOIN events e ON e.id = u.event_id WHERE e.band_id = b.id) AS reports_unlocked,
                (SELECT COALESCE(SUM(u.amount), 0) FROM event_unlocks u
                   JOIN events e ON e.id = u.event_id WHERE e.band_id = b.id) AS fees_charged
           FROM bands b
          WHERE ${filter}
          ORDER BY b.created_at DESC
          LIMIT ?3 OFFSET ?4`,
      )
      .bind(options.search, pattern, options.limit, options.offset),
    db.prepare(`SELECT COUNT(*) AS n FROM bands b WHERE ${filter}`).bind(options.search, pattern),
  ]);

  const rows = (page?.results ?? []).map((r) => {
    const row = r as Record<string, unknown>;
    return {
      id: String(row["id"]),
      name: String(row["name"]),
      contactEmail: String(row["contact_email"]),
      createdAt: String(row["created_at"]),
      bannedAt: (row["banned_at"] as string | null) ?? null,
      freePassGrantedAt: (row["free_pass_granted_at"] as string | null) ?? null,
      freePassUntil: (row["free_pass_until"] as string | null) ?? null,
      events: Number(row["events"] ?? 0),
      paidTickets: Number(row["paid_tickets"] ?? 0),
      lastActivity: String(row["last_activity"] ?? row["created_at"]),
      reportsUnlocked: Number(row["reports_unlocked"] ?? 0),
      feesCharged: Number(row["fees_charged"] ?? 0),
    };
  });
  const total = Number((count?.results?.[0] as { n?: number } | undefined)?.n ?? 0);
  return { rows, total };
}

export type OperatorEventRow = {
  id: string;
  name: string;
  slug: string;
  startsAt: string;
  status: string;
  paidTickets: number;
  unlockBracket: string | null;
  unlockAmount: number | null;
  unlockMethod: string | null;
};

/**
 * A band's events for the operator, newest show first, with what each unlock
 * recorded. Capped well past any real band's history; the cap is a guard, not
 * a page.
 */
export async function bandEventsForOperator(
  db: D1Database,
  bandId: string,
): Promise<OperatorEventRow[]> {
  const { results } = await db
    .prepare(
      `SELECT e.id, e.name, e.slug, e.starts_at, e.status,
              (SELECT COUNT(*) FROM attendees a
                 JOIN orders o ON o.id = a.order_id
                WHERE o.event_id = e.id AND ${PAID_TICKET}) AS paid_tickets,
              u.bracket, u.amount, u.method
         FROM events e
         LEFT JOIN event_unlocks u ON u.event_id = e.id
        WHERE e.band_id = ?1
        ORDER BY e.starts_at DESC
        LIMIT 500`,
    )
    .bind(bandId)
    .all();
  return results.map((r) => {
    const row = r as Record<string, unknown>;
    return {
      id: String(row["id"]),
      name: String(row["name"]),
      slug: String(row["slug"]),
      startsAt: String(row["starts_at"]),
      status: String(row["status"]),
      paidTickets: Number(row["paid_tickets"] ?? 0),
      unlockBracket: (row["bracket"] as string | null) ?? null,
      unlockAmount: row["amount"] === null ? null : Number(row["amount"]),
      unlockMethod: (row["method"] as string | null) ?? null,
    };
  });
}

/** The band's standing changes, newest first. */
export async function operatorActionsFor(db: DrizzleD1Database<typeof s>, bandId: string) {
  return db
    .select()
    .from(s.operatorActions)
    .where(eq(s.operatorActions.bandId, bandId))
    .orderBy(desc(s.operatorActions.createdAt))
    .limit(100);
}

type ActionInput = { bandId: string; operatorEmail: string; at: string };

/**
 * Each change writes the band and its log row in one batch, so the log can
 * never miss a change that happened or record one that did not.
 */
function logAction(
  db: DrizzleD1Database<typeof s>,
  input: ActionInput,
  action: "ban" | "unban" | "free_pass" | "free_pass_end",
  note: string | null,
) {
  return db.insert(s.operatorActions).values({
    id: newId("opa"),
    bandId: input.bandId,
    operatorEmail: input.operatorEmail,
    action,
    note,
    createdAt: input.at,
  });
}

export async function banBand(
  db: DrizzleD1Database<typeof s>,
  input: ActionInput & { reason: string },
) {
  await db.batch([
    db
      .update(s.bands)
      .set({ bannedAt: input.at, banReason: input.reason })
      .where(eq(s.bands.id, input.bandId)),
    logAction(db, input, "ban", input.reason),
  ]);
}

export async function unbanBand(
  db: DrizzleD1Database<typeof s>,
  input: ActionInput & { note: string | null },
) {
  await db.batch([
    db.update(s.bands).set({ bannedAt: null, banReason: null }).where(eq(s.bands.id, input.bandId)),
    logAction(db, input, "unban", input.note),
  ]);
}

/** Grants a pass, or replaces the one the band holds with new dates and note. */
export async function grantFreePass(
  db: DrizzleD1Database<typeof s>,
  input: ActionInput & { until: string | null; note: string },
) {
  const summary = `${input.until ? `hasta ${input.until}` : "sin fecha de fin"} · ${input.note}`;
  await db.batch([
    db
      .update(s.bands)
      .set({ freePassGrantedAt: input.at, freePassUntil: input.until, freePassNote: input.note })
      .where(eq(s.bands.id, input.bandId)),
    logAction(db, input, "free_pass", summary),
  ]);
}

export async function endFreePass(db: DrizzleD1Database<typeof s>, input: ActionInput) {
  await db.batch([
    db
      .update(s.bands)
      .set({ freePassGrantedAt: null, freePassUntil: null, freePassNote: null })
      .where(eq(s.bands.id, input.bandId)),
    logAction(db, input, "free_pass_end", null),
  ]);
}
