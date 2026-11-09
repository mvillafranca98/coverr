import { and, eq, isNull, sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { computeSettlement } from "../../lib/settlement";
import { NOTE_ONLY_FLAG } from "../../lib/verify";
import * as s from "../schema";

/**
 * Revenue and headcount per channel. Comps contribute people, never money.
 *
 * Counted from ticket rows rather than from `orders.quantity`, because a
 * partially refunded order keeps its quantity and loses tickets. While nothing
 * is voided the two agree exactly — every write path inserts one attendee per
 * ticket and sets `expected_amount = unit_amount * quantity` — so this is the
 * same arithmetic until a band actually refunds part of an order.
 */
export async function channelTotals(db: DrizzleD1Database<typeof s>, eventId: string) {
  const rows = await db
    .select({
      channel: s.orders.channel,
      people: sql<number>`count(*)`,
      amount: sql<number>`sum(${s.orders.unitAmount})`,
    })
    .from(s.attendees)
    .innerJoin(s.orders, eq(s.attendees.orderId, s.orders.id))
    .where(
      and(
        eq(s.orders.eventId, eventId),
        eq(s.orders.status, "confirmed"),
        isNull(s.attendees.voidedAt),
      ),
    )
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
        isNull(s.attendees.voidedAt),
        sql`${s.attendees.checkedInAt} is not null`,
      ),
    );
  counts.inside = Number(inside?.n ?? 0);

  return { counts, channels };
}

/**
 * How much of the gross comes from orders a person still has to look at: an
 * open flag other than the sender-name note. Counted the way `channelTotals`
 * counts gross — live tickets on confirmed orders — so it is a part of that
 * figure, never more than it.
 *
 * The gross counts what each receipt says was paid, and a flagged receipt is
 * exactly the one that may not have been. This is not a lock: the report stays
 * readable, it only says how much of it is still unconfirmed.
 */
export async function takingsUnderReview(
  db: DrizzleD1Database<typeof s>,
  eventId: string,
): Promise<{ orders: number; amount: number }> {
  const [row] = await db
    .select({
      orders: sql<number>`count(distinct ${s.orders.id})`,
      amount: sql<number>`coalesce(sum(${s.orders.unitAmount}), 0)`,
    })
    .from(s.attendees)
    .innerJoin(s.orders, eq(s.attendees.orderId, s.orders.id))
    .where(
      and(
        eq(s.orders.eventId, eventId),
        eq(s.orders.status, "confirmed"),
        isNull(s.attendees.voidedAt),
        sql`exists (select 1 from ${s.verificationFlags} where ${s.verificationFlags.orderId} = ${s.orders.id} and ${s.verificationFlags.resolvedAt} is null and ${s.verificationFlags.code} != ${NOTE_ONLY_FLAG})`,
      ),
    );
  return { orders: Number(row?.orders ?? 0), amount: Number(row?.amount ?? 0) };
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
