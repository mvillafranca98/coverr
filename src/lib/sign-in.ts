/**
 * What a band's sign-in link and its session cookie carry, and how a link is
 * spent once.
 *
 * Both are signed payloads (lib/auth.ts). A link used to carry only the band's
 * id — the same as the 30-day cookie — so it could be opened as often as
 * anyone liked for its 15 minutes, and could even be pasted in as a cookie.
 * Now each link names its purpose and carries an id of its own; redeeming it
 * records that id, and a second redemption is refused (SEC-05).
 */

type Payload = Record<string, unknown> | null;

/** A band's sign-in link: the band, what it is for, and an id to spend it by. */
export function bandLoginPayload(bandId: string) {
  return { b: bandId, use: "band-login", jti: crypto.randomUUID() };
}

/** A band's session cookie. Carries no link id: it is never spent, only expired. */
export function bandSessionPayload(bandId: string) {
  return { b: bandId, use: "band-session" };
}

const nonEmpty = (value: unknown): value is string => typeof value === "string" && value !== "";

/** The band a verified sign-in link opens, or null when it is not one. */
export function bandFromLoginLink(payload: Payload): string | null {
  if (payload?.["use"] !== "band-login" || !nonEmpty(payload["jti"])) return null;
  return nonEmpty(payload["b"]) ? payload["b"] : null;
}

/**
 * The band a verified session cookie belongs to, or null. Sessions signed
 * before links became single-use carry no `use` and stay valid until they
 * expire, so nobody is signed out by the change. What is refused is a sign-in
 * link set as a cookie, which would open the panel without spending it.
 */
export function bandFromSession(payload: Payload): string | null {
  if (!payload) return null;
  const use = payload["use"];
  if (use !== undefined && use !== "band-session") return null;
  return nonEmpty(payload["b"]) ? payload["b"] : null;
}

/** The id to spend a verified link by, and when it would have expired anyway. */
export function linkToSpend(payload: Payload): { linkId: string; expiresAt: string } | null {
  if (!payload || !nonEmpty(payload["jti"]) || typeof payload["exp"] !== "number") return null;
  return { linkId: payload["jti"], expiresAt: new Date(payload["exp"] * 1000).toISOString() };
}
