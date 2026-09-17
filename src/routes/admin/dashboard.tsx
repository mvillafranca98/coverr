import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { and, eq, isNull, sql } from "drizzle-orm";
import * as s from "../../db/schema";
import { DashboardPage } from "../../views/admin";
import { findBand } from "../../db/queries/bands";
import { findEventBySlug } from "../../db/queries/events";
import { settlementFor } from "../../db/queries/event-totals";
import type { AdminEnv } from "./context";

export const dashboardRoutes = new Hono<AdminEnv>();

/**
 * The live view during a show. Free forever and deliberately so — locking it
 * behind the unlock fee would break the product on the night, which is far
 * worse than losing the occasional fee.
 */
dashboardRoutes.get("/e/:slug", async (c) => {
  const db = drizzle(c.env.DB, { schema: s });
  const bandId = c.get("bandId");
  const band = await findBand(db, bandId);
  const event = await findEventBySlug(db, bandId, c.req.param("slug"));
  if (!band || !event) return c.notFound();

  const { counts, channels, settlement } = await settlementFor(db, bandId, event.id);

  // Which account each order says it paid into, so the band knows whose
  // statement to open. Buyers can ignore the picker, hence the not-null filter.
  const byAccount = await db
    .select({
      bank: s.orders.bankSelected,
      count: sql<number>`count(*)`,
      amount: sql<number>`sum(${s.orders.expectedAmount})`,
    })
    .from(s.orders)
    .where(
      and(
        eq(s.orders.eventId, event.id),
        eq(s.orders.status, "confirmed"),
        sql`${s.orders.bankSelected} is not null`,
      ),
    )
    .groupBy(s.orders.bankSelected);

  const [openFlags] = await db
    .select({ n: sql<number>`count(*)` })
    .from(s.verificationFlags)
    .innerJoin(s.orders, eq(s.verificationFlags.orderId, s.orders.id))
    .where(and(eq(s.orders.eventId, event.id), isNull(s.verificationFlags.resolvedAt)));

  const [openRefunds] = await db
    .select({ n: sql<number>`count(*)` })
    .from(s.refundRequests)
    .innerJoin(s.orders, eq(s.refundRequests.orderId, s.orders.id))
    .where(and(eq(s.orders.eventId, event.id), eq(s.refundRequests.status, "open")));

  return c.html(
    <DashboardPage
      bandName={band.name}
      openRefunds={Number(openRefunds?.n ?? 0)}
      event={event}
      counts={counts}
      channels={channels}
      byAccount={byAccount.map((a) => ({
        bank: a.bank ?? "OTHER",
        count: Number(a.count),
        amount: Number(a.amount),
      }))}
      wristbands={{
        start: event.wristbandsStart,
        left: event.wristbandsStart != null ? event.wristbandsStart - counts.inside : null,
      }}
      openFlags={Number(openFlags?.n ?? 0)}
      settlement={settlement}
      scanUrl={event.staffToken ? `${c.env.APP_ORIGIN}/scan/${event.staffToken}` : null}
    />,
  );
});
