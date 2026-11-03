import { normalizeEmail } from "./core";

/**
 * Who counts as Coverr's operator, and what proves it.
 *
 * Operators are the addresses in the OPERATOR_EMAILS setting and nobody else;
 * there is no operator table a bug could write a row into. The list is checked
 * on every request, not only at sign-in, so taking an address off it ends that
 * person's access at once rather than when their cookie runs out.
 */

/** True when this address is on the operator list. Case and spacing do not matter. */
export function isOperatorEmail(email: string, operatorEmails: readonly string[] | undefined) {
  if (!operatorEmails?.length) return false;
  const address = normalizeEmail(email);
  return address !== "" && operatorEmails.some((listed) => normalizeEmail(listed) === address);
}

/**
 * What an operator sign-in link and an operator cookie each carry.
 *
 * `op` is a field no band token has, so a band's link or cookie can never pass
 * as an operator's. `use` keeps the two apart as well: a 15-minute link is not
 * a 12-hour session, and a session copied out of a cookie does not sign in.
 */
export type OperatorTokenUse = "operator-login" | "operator-session";

export function operatorTokenPayload(email: string, use: OperatorTokenUse) {
  return { op: normalizeEmail(email), use };
}

/** The operator a verified token names, or null when it is not that kind of token. */
export function operatorFromToken(
  payload: Record<string, unknown> | null,
  use: OperatorTokenUse,
): string | null {
  if (!payload || payload["use"] !== use) return null;
  const email = payload["op"];
  return typeof email === "string" && email !== "" ? email : null;
}
