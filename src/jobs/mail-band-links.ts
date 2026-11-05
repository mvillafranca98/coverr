import { LOGIN_TTL, sessionSecret, sign } from "../lib/auth";
import { makeTransport } from "../lib/email";
import { bandCreatePayload, bandEmailChangePayload, bandLoginPayload } from "../lib/sign-in";
import {
  createBandEmailHtml,
  createBandEmailSubject,
  createBandEmailText,
  emailChangeEmailHtml,
  emailChangeEmailSubject,
  emailChangeEmailText,
  LOGIN_EMAIL_SUBJECT,
  loginEmailHtml,
  loginEmailText,
} from "../views/email";

type Env = Parameters<typeof makeTransport>[0] & { SESSION_SECRET?: string; APP_ORIGIN: string };

const MINUTES = Math.round(LOGIN_TTL / 60);

/**
 * The links a band's person gets by mail, sent after the response so a
 * page that mails and a page that does not answer in the same time. A failed
 * send is logged, never thrown: the page has already said "revisá tu correo".
 */

/** A sign-in link for `email`, naming what it opens: one band, or "tus bandas". */
export async function mailBandSignInLink(env: Env, email: string, title: string): Promise<void> {
  const token = await sign(sessionSecret(env), bandLoginPayload(email), LOGIN_TTL);
  const url = `${env.APP_ORIGIN}/admin/entrar?t=${encodeURIComponent(token)}`;
  const mail = { bandName: title, url, minutes: MINUTES };
  const result = await makeTransport(env).send({
    to: email,
    subject: LOGIN_EMAIL_SUBJECT,
    html: loginEmailHtml(mail),
    text: loginEmailText(mail),
  });
  if (!result.ok) console.error(`[sign-in] link failed for ${email}: ${result.error}`);
}

/** A link that creates the band `name` under `email` once it is opened. */
export async function mailBandCreateLink(env: Env, email: string, name: string): Promise<void> {
  const token = await sign(sessionSecret(env), bandCreatePayload(email, name), LOGIN_TTL);
  const url = `${env.APP_ORIGIN}/admin/crear?t=${encodeURIComponent(token)}`;
  const mail = { bandName: name, url, minutes: MINUTES };
  const result = await makeTransport(env).send({
    to: email,
    subject: createBandEmailSubject(mail),
    html: createBandEmailHtml(mail),
    text: createBandEmailText(mail),
  });
  if (!result.ok) console.error(`[sign-up] create link failed for ${email}: ${result.error}`);
}

/** A link, mailed to `change.to`, that moves the band onto that address once it is opened. */
export async function mailBandEmailChangeLink(
  env: Env,
  change: { bandId: string; bandName: string; from: string; to: string },
): Promise<void> {
  const payload = bandEmailChangePayload(change.bandId, change.from, change.to);
  const token = await sign(sessionSecret(env), payload, LOGIN_TTL);
  const url = `${env.APP_ORIGIN}/admin/correo?t=${encodeURIComponent(token)}`;
  const mail = { bandName: change.bandName, url, minutes: MINUTES };
  const result = await makeTransport(env).send({
    to: change.to,
    subject: emailChangeEmailSubject(mail),
    html: emailChangeEmailHtml(mail),
    text: emailChangeEmailText(mail),
  });
  if (!result.ok)
    console.error(`[band-email] change link failed for ${change.to}: ${result.error}`);
}
