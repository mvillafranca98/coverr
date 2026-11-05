/**
 * What a band's sign-in link, its band-creation link, its email-change link and
 * its session cookie carry, and how a link is spent once.
 *
 * All four are signed payloads (lib/auth.ts). Each link names its purpose and
 * carries an id of its own; redeeming it records that id, and a second
 * redemption is refused (SEC-05). Links name a person — an email, which may run
 * several bands — and the session names the band in use plus the email that
 * proved itself by opening the link, which is what lets it switch between that
 * email's bands and nobody else's.
 */

type Payload = Record<string, unknown> | null;

/** A sign-in link: the person, what it is for, and an id to spend it by. */
export function bandLoginPayload(email: string) {
  return { e: email, use: "band-login", jti: crypto.randomUUID() };
}

/**
 * A link that creates a band, sent from /registro. The band does not exist
 * until it is opened, so nobody can create bands under an address they cannot
 * read.
 */
export function bandCreatePayload(email: string, name: string) {
  return { e: email, n: name, use: "band-create", jti: crypto.randomUUID() };
}

/**
 * A link that moves a band onto a new address, mailed to that address. A
 * band's email is its person: it signs in with it, and its debts and
 * suspensions follow it to every band under it. So a band is never moved under
 * an address that has not said yes. `f` is the address the band had when the
 * move was asked for; once the band has moved, every link sent before it is
 * dead.
 */
export function bandEmailChangePayload(bandId: string, from: string, to: string) {
  return { b: bandId, f: from, e: to, use: "band-email-change", jti: crypto.randomUUID() };
}

/** A session: the band in use, and the email it was signed into with. */
export function bandSessionPayload(bandId: string, email: string) {
  return { b: bandId, e: email, use: "band-session" };
}

const nonEmpty = (value: unknown): value is string => typeof value === "string" && value !== "";

/** The person a verified sign-in link signs in, or null when it is not one. */
export function emailFromLoginLink(payload: Payload): string | null {
  if (payload?.["use"] !== "band-login" || !nonEmpty(payload["jti"])) return null;
  return nonEmpty(payload["e"]) ? payload["e"] : null;
}

/** The person and band name a verified creation link carries, or null. */
export function bandToCreate(payload: Payload): { email: string; name: string } | null {
  if (payload?.["use"] !== "band-create" || !nonEmpty(payload["jti"])) return null;
  const email = payload["e"];
  const name = payload["n"];
  return nonEmpty(email) && nonEmpty(name) ? { email, name } : null;
}

/** The band, its address when asked, and its new address, from a verified email-change link. */
export function emailChangeFromLink(
  payload: Payload,
): { bandId: string; from: string; to: string } | null {
  if (payload?.["use"] !== "band-email-change" || !nonEmpty(payload["jti"])) return null;
  const bandId = payload["b"];
  const from = payload["f"];
  const to = payload["e"];
  return nonEmpty(bandId) && nonEmpty(from) && nonEmpty(to) ? { bandId, from, to } : null;
}

/**
 * The band a verified session cookie belongs to, or null. Sessions signed
 * before links became single-use carry no `use` and stay valid until they
 * expire, so nobody is signed out by the change. What is refused is a link set
 * as a cookie, which would open the panel without spending it.
 */
export function bandFromSession(payload: Payload): string | null {
  if (!payload) return null;
  const use = payload["use"];
  if (use !== undefined && use !== "band-session") return null;
  return nonEmpty(payload["b"]) ? payload["b"] : null;
}

/**
 * The email a session proved by its sign-in link, or null. Older sessions
 * carry none; they keep their band but cannot switch to another until the
 * person signs in again.
 */
export function emailFromSession(payload: Payload): string | null {
  if (payload?.["use"] !== "band-session") return null;
  return nonEmpty(payload["e"]) ? payload["e"] : null;
}

/** The id to spend a verified link by, and when it would have expired anyway. */
export function linkToSpend(payload: Payload): { linkId: string; expiresAt: string } | null {
  if (!payload || !nonEmpty(payload["jti"]) || typeof payload["exp"] !== "number") return null;
  return { linkId: payload["jti"], expiresAt: new Date(payload["exp"] * 1000).toISOString() };
}
