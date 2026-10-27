import { and, eq, sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as s from "../schema";

type PriceRule = typeof s.priceRules.$inferSelect;

async function rulesInOrder(db: DrizzleD1Database<typeof s>, eventId: string) {
  return db
    .select()
    .from(s.priceRules)
    .where(eq(s.priceRules.eventId, eventId))
    .orderBy(s.priceRules.sortOrder);
}

/**
 * The rule a buyer may actually purchase at right now, or null when nothing is
 * on sale. Presale runs until its window closes or it sells out; box office
 * takes over on its own start time or on presale selloff, whichever comes
 * first.
 *
 * This is the authoritative one: it is re-run server-side at purchase, so the
 * client never gets to name a price. Returning null is a real answer — it means
 * "sold out", and the buyer page must say so rather than fall back to a price.
 */
export async function resolveSellableRule(
  db: DrizzleD1Database<typeof s>,
  eventId: string,
): Promise<PriceRule | null> {
  const rules = await rulesInOrder(db, eventId);
  if (rules.length === 0) return null;

  const soldByRule = new Map<string, number>();
  const counts = await db
    .select({
      ruleId: s.orders.priceRuleId,
      qty: sql<number>`coalesce(sum(${s.orders.quantity}), 0)`,
    })
    .from(s.orders)
    .where(and(eq(s.orders.eventId, eventId), eq(s.orders.status, "confirmed")))
    .groupBy(s.orders.priceRuleId);
  for (const c of counts) if (c.ruleId) soldByRule.set(c.ruleId, Number(c.qty));

  const isSoldOut = (r: PriceRule) => r.maxQty != null && (soldByRule.get(r.id) ?? 0) >= r.maxQty;

  const now = new Date();
  for (const rule of rules) {
    const started = !rule.startsAt || new Date(rule.startsAt) <= now;
    const ended = rule.endsAt != null && new Date(rule.endsAt) <= now;
    const predecessorSoldOut = rule.activatesOnSelloffOf
      ? isSoldOut(rules.find((r) => r.id === rule.activatesOnSelloffOf) ?? rule)
      : false;

    if (isSoldOut(rule) || ended) continue;
    if (started || predecessorSoldOut) return rule;
  }
  return null;
}

/**
 * The price to pre-fill an admin form with. Deliberately weaker than
 * `resolveSellableRule`: it ignores sellout and falls back to the last rule, so
 * a manual sale after the presale cap is hit still opens with a sensible
 * number instead of a blank. The admin can always override it, which is the
 * whole point of a manual sale.
 */
export async function currentPriceRule(
  db: DrizzleD1Database<typeof s>,
  eventId: string,
): Promise<PriceRule | null> {
  const rules = await rulesInOrder(db, eventId);
  const now = new Date();
  for (const rule of rules) {
    const started = !rule.startsAt || new Date(rule.startsAt) <= now;
    const ended = rule.endsAt != null && new Date(rule.endsAt) <= now;
    if (started && !ended) return rule;
  }
  return rules[rules.length - 1] ?? null;
}
