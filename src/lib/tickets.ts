import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import * as s from "../db/schema";
import { makeTransport } from "./email";
import { ticketEmailHtml, ticketEmailText, ticketEmailSubject } from "../views/email";

type Env = {
  DB: D1Database;
  PROOFS?: R2Bucket;
  APP_ORIGIN: string;
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
};

/**
 * Sends one order's tickets. Never throws into the request path: a mail failure
 * must not cost the buyer their confirmation page, since they have already
 * paid by the time we get here. Failures are logged for the admin to chase.
 */
export async function sendTickets(env: Env, orderId: string): Promise<boolean> {
  const db = drizzle(env.DB, { schema: s });
  const rows = await db
    .select({ order: s.orders, event: s.events, band: s.bands })
    .from(s.orders)
    .innerJoin(s.events, eq(s.orders.eventId, s.events.id))
    .innerJoin(s.bands, eq(s.events.bandId, s.bands.id))
    .where(eq(s.orders.id, orderId))
    .limit(1);
  const row = rows[0];
  if (!row || row.order.status !== "confirmed") return false;

  const atts = await db.select().from(s.attendees).where(eq(s.attendees.orderId, orderId));
  if (atts.length === 0) return false;

  const input = {
    band: row.band,
    event: row.event,
    order: row.order,
    attendees: atts,
    origin: env.APP_ORIGIN,
  };

  const result = await makeTransport(env).send({
    to: row.order.payerEmail,
    subject: ticketEmailSubject(input),
    html: ticketEmailHtml(input),
    text: ticketEmailText(input),
    replyTo: row.band.contactEmail,
  });

  if (!result.ok) {
    console.error(`[tickets] send failed order=${row.order.shortCode} ${result.error}`);
    return false;
  }
  console.log(`[tickets] sent order=${row.order.shortCode} to=${row.order.payerEmail}`);
  return true;
}
