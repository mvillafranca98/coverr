import { drizzle } from "drizzle-orm/d1";
import { recoverableOrdersForPayer } from "../db/queries/orders";
import * as s from "../db/schema";
import { makeTransport } from "../lib/email";
import { RECOVERY_EMAIL_SUBJECT, recoveryEmailHtml, recoveryEmailText } from "../views/email";

type Env = {
  DB: D1Database;
  PROOFS?: R2Bucket;
  APP_ORIGIN: string;
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
};

/** How many orders one recovery email lists. More than a person holds for upcoming shows. */
const MAX_ORDERS = 20;

/** A show stays recoverable for a day after it starts, so a ticket lost at the door still comes back. */
const RECOVERY_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Mails a buyer one email with every order they can still use, after
 * `/recuperar` has already answered.
 *
 * It used to resend each order's full ticket email, one by one, for every show
 * the address had ever bought: ten orders were ten emails from one request.
 * Sends nothing when the address has no upcoming order, and the page answers
 * the same either way.
 */
export async function sendTicketRecovery(env: Env, payerEmail: string): Promise<boolean> {
  const db = drizzle(env.DB, { schema: s });
  const orders = await recoverableOrdersForPayer(db, {
    payerEmail,
    eventStartedAfter: new Date(Date.now() - RECOVERY_WINDOW_MS).toISOString(),
    limit: MAX_ORDERS,
  });
  if (orders.length === 0) return false;

  const input = { orders, origin: env.APP_ORIGIN };
  const result = await makeTransport(env).send({
    to: payerEmail,
    subject: RECOVERY_EMAIL_SUBJECT,
    html: recoveryEmailHtml(input),
    text: recoveryEmailText(input),
  });
  if (!result.ok) {
    console.error(`[recovery] send failed orders=${orders.length}: ${result.error}`);
    return false;
  }
  console.log(`[recovery] sent orders=${orders.length}`);
  return true;
}
