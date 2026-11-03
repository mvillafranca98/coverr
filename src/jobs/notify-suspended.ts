import { makeTransport } from "../lib/email";
import { SUSPENDED_EMAIL_SUBJECT, suspendedEmailHtml, suspendedEmailText } from "../views/email";

type Env = Parameters<typeof makeTransport>[0];

/**
 * Tells a banned band why the sign-in link it asked for is not coming. Run
 * from waitUntil by both sign-in and sign-up, so either page answers in the
 * same time and with the same words as it does for a band in good standing.
 */
export async function sendSuspendedNotice(
  env: Env,
  band: { id: string; name: string; contactEmail: string },
): Promise<void> {
  const mail = { bandName: band.name };
  const result = await makeTransport(env).send({
    to: band.contactEmail,
    subject: SUSPENDED_EMAIL_SUBJECT,
    html: suspendedEmailHtml(mail),
    text: suspendedEmailText(mail),
  });
  if (!result.ok) console.error(`[suspended] notice failed for band=${band.id}: ${result.error}`);
}
