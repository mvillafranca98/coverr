import { and, eq, isNull, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import * as s from "../db/schema";
import { makeTransport } from "../lib/email";
import { flagAlertEmailHtml, flagAlertEmailSubject, flagAlertEmailText } from "../views/email";

type Env = {
  DB: D1Database;
  PROOFS?: R2Bucket;
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
  APP_ORIGIN: string;
};

/**
 * How many orders in one event may raise an alert before the rest go quiet.
 *
 * A band whose eleventh order fails a critical check has a problem no email
 * can convey, and three hundred of them would train them to filter the sender
 * — which would cost them the one that mattered. The flags are all still in
 * the dashboard; only the interruption stops.
 */
export const ALERT_CAP_PER_EVENT = 10;

/**
 * Decides whether this order's flags are worth interrupting the band for.
 *
 * Separated out and exported so the policy can be tested without a database:
 * everything above it is queries, everything below is sending.
 */
export function shouldAlert(input: {
  flags: { severity: string }[];
  /** Orders in this event already carrying an unresolved critical flag. */
  alreadyFlaggedOrders: number;
}): boolean {
  // Warnings and info never interrupt. NAME_MISMATCH fires on ordinary group
  // purchases — one person paying for four is the common case — and a band
  // emailed about those learns to ignore the sender within a week.
  if (!input.flags.some((f) => f.severity === "critical")) return false;
  return input.alreadyFlaggedOrders <= ALERT_CAP_PER_EVENT;
}

/**
 * Emails the band when a purchase fails a check that cannot be explained away.
 *
 * Critical is the whole trigger: a recycled proof, or money that went to an
 * account the band does not own. Both are cases where somebody may be getting
 * in without paying, and both were previously written to the database and
 * surfaced nowhere until a human happened to look.
 *
 * Runs after the response like every other job here. It cannot fail a
 * purchase: the buyer already holds their QR codes, and nothing in here takes
 * them away.
 */
export async function notifyCriticalFlags(env: Env, orderId: string): Promise<boolean> {
  const db = drizzle(env.DB, { schema: s });

  const rows = await db
    .select({ order: s.orders, event: s.events, band: s.bands })
    .from(s.orders)
    .innerJoin(s.events, eq(s.orders.eventId, s.events.id))
    .innerJoin(s.bands, eq(s.events.bandId, s.bands.id))
    .where(eq(s.orders.id, orderId))
    .limit(1);
  const row = rows[0];
  if (!row) return false;
  const { order, event, band } = row;

  const flags = await db
    .select({ code: s.verificationFlags.code, detail: s.verificationFlags.detail })
    .from(s.verificationFlags)
    .where(
      and(
        eq(s.verificationFlags.orderId, orderId),
        eq(s.verificationFlags.severity, "critical"),
        isNull(s.verificationFlags.resolvedAt),
      ),
    );
  if (flags.length === 0) return false;

  // Counted across the event, not the order: the cap exists to stop a bad
  // batch becoming a mailbox full of identical alerts.
  const [counted] = await db
    .select({ n: sql<number>`count(distinct ${s.verificationFlags.orderId})` })
    .from(s.verificationFlags)
    .innerJoin(s.orders, eq(s.verificationFlags.orderId, s.orders.id))
    .where(
      and(
        eq(s.orders.eventId, event.id),
        eq(s.verificationFlags.severity, "critical"),
        isNull(s.verificationFlags.resolvedAt),
      ),
    );

  if (
    !shouldAlert({
      flags: flags.map(() => ({ severity: "critical" })),
      alreadyFlaggedOrders: Number(counted?.n ?? 0),
    })
  ) {
    console.log(`[flags] alert capped for ${order.shortCode} — event already over the limit`);
    return false;
  }

  const mail = { event, order, flags, origin: env.APP_ORIGIN };
  const result = await makeTransport(env).send({
    to: band.contactEmail,
    // The band's likely next move is to ask the buyer what happened.
    replyTo: order.payerEmail,
    subject: flagAlertEmailSubject(mail),
    html: flagAlertEmailHtml(mail),
    text: flagAlertEmailText(mail),
  });

  if (!result.ok) {
    console.error(`[flags] alert failed for ${order.shortCode}: ${result.error}`);
    return false;
  }
  console.log(`[flags] alerted ${band.contactEmail} about ${order.shortCode}`);
  return true;
}
