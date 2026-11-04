import { and, eq, inArray } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { newId } from "../../lib/core";
import type { MemberTable } from "../../lib/member-split";
import * as s from "../schema";

type Db = DrizzleD1Database<typeof s>;

/** This band's member ids, for checking a submitted table against. */
export async function bandMemberIds(db: Db, bandId: string): Promise<string[]> {
  const rows = await db
    .select({ id: s.bandMembers.id })
    .from(s.bandMembers)
    .where(eq(s.bandMembers.bandId, bandId));
  return rows.map((row) => row.id);
}

/**
 * The names of those members who have advances on record. Removing a member
 * deletes their advances with them, so a band has to clear those first and
 * never loses one by ticking a box.
 */
export async function membersWithAdvances(
  db: Db,
  bandId: string,
  memberIds: readonly string[],
): Promise<string[]> {
  if (memberIds.length === 0) return [];
  const rows = await db
    .selectDistinct({ name: s.bandMembers.name })
    .from(s.advances)
    .innerJoin(s.bandMembers, eq(s.advances.memberId, s.bandMembers.id))
    .where(and(eq(s.advances.bandId, bandId), inArray(s.advances.memberId, [...memberIds])));
  return rows.map((row) => row.name);
}

/**
 * Writes the whole table in one batch, so the split on record always totals
 * what the band saw total. Every statement is scoped to the band; the caller
 * has already checked the ids are this band's own.
 */
export async function saveMemberTable(db: Db, bandId: string, table: MemberTable): Promise<void> {
  const statements: BatchItem<"sqlite">[] = table.rows.map((row, sortOrder) =>
    row.id
      ? db
          .update(s.bandMembers)
          .set({ name: row.name, splitPct: row.splitPct, sortOrder })
          .where(and(eq(s.bandMembers.id, row.id), eq(s.bandMembers.bandId, bandId)))
      : db.insert(s.bandMembers).values({
          id: newId("mem"),
          bandId,
          name: row.name,
          splitPct: row.splitPct,
          isCore: 1,
          sortOrder,
        }),
  );
  if (table.removeIds.length > 0) {
    statements.push(
      db
        .delete(s.bandMembers)
        .where(and(eq(s.bandMembers.bandId, bandId), inArray(s.bandMembers.id, table.removeIds))),
    );
  }
  const [first, ...rest] = statements;
  if (first) await db.batch([first, ...rest]);
}
