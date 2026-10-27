import { and, eq, sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { computeSettlement } from "../../lib/settlement";
import * as s from "../schema";

/** Revenue and headcount per channel. Comps contribute people, never money. */
export async function channelTotals(db: DrizzleD1Database<typeof s>, eventId: string) {
  const rows = await db
    .select({
      channel: s.orders.channel,
      people: sql<number>`sum(${s.orders.quantity})`,
      amount: sql<number>`sum(${s.orders.expectedAmount})`,
    })
    .from(s.orders)
    .where(and(eq(s.orders.eventId, eventId), eq(s.orders.status, "confirmed")))
    .groupBy(s.orders.channel);

  const by = (channel: string) => rows.find((r) => r.channel === channel);
  const counts = {
    presale: Number(by("online")?.people ?? 0),
    doorOnline: Number(by("door_online")?.people ?? 0),
    doorCash: Number(by("door_cash")?.people ?? 0),
    manual: Number(by("manual")?.people ?? 0),
    comp: Number(by("comp")?.people ?? 0),
    sold: 0,
    inside: 0,
  };
  counts.sold = counts.presale + counts.doorOnline + counts.doorCash + counts.manual + counts.comp;

  const channels = {
    presale: Number(by("online")?.amount ?? 0),
    doorTransfer: Number(by("door_online")?.amount ?? 0),
    doorCash: Number(by("door_cash")?.amount ?? 0),
    manual: Number(by("manual")?.amount ?? 0),
    comp: 0,
  };

  const [inside] = await db
    .select({ n: sql<number>`count(*)` })
    .from(s.attendees)
    .innerJoin(s.orders, eq(s.attendees.orderId, s.orders.id))
    .where(
      and(
        eq(s.orders.eventId, eventId),
        eq(s.orders.status, "confirmed"),
        sql`${s.attendees.checkedInAt} is not null`,
      ),
    );
  counts.inside = Number(inside?.n ?? 0);

  return { counts, channels };
}

/**
 * Everything the settlement view needs: the counts, the per-channel money, and
 * the split arithmetic run over them. The maths itself lives in
 * `lib/settlement`; this only gathers its inputs.
 */
export async function settlementFor(
  db: DrizzleD1Database<typeof s>,
  bandId: string,
  eventId: string,
) {
  const { counts, channels } = await channelTotals(db, eventId);

  const [costRow] = await db
    .select({ n: sql<number>`coalesce(sum(${s.expenses.amount}), 0)` })
    .from(s.expenses)
    .where(eq(s.expenses.eventId, eventId));

  const members = await db
    .select()
    .from(s.bandMembers)
    .where(eq(s.bandMembers.bandId, bandId))
    .orderBy(s.bandMembers.sortOrder);

  const advanceRows = await db
    .select({
      memberId: s.advances.memberId,
      total: sql<number>`coalesce(sum(${s.advances.amount}), 0)`,
    })
    .from(s.advances)
    .where(and(eq(s.advances.bandId, bandId), eq(s.advances.eventId, eventId)))
    .groupBy(s.advances.memberId);
  const advancesByMemberId = new Map(advanceRows.map((a) => [a.memberId, Number(a.total)]));

  return {
    counts,
    channels,
    settlement: computeSettlement({
      channels,
      costs: Number(costRow?.n ?? 0),
      headcount: counts.sold,
      members: members.map((m) => ({
        id: m.id,
        name: m.name,
        splitPct: m.splitPct,
        advances: advancesByMemberId.get(m.id) ?? 0,
      })),
    }),
    advancesByMember: Object.fromEntries(advancesByMemberId),
  };
}
