/**
 * Admin auth: magic link in, signed cookie after.
 *
 * The door scanner gets a bare URL token because staff are at a venue with no
 * inbox and no signal. The admin is the opposite case — they see every buyer's
 * email, phone and payment proof, so this side gets a real session and a link
 * that expires.
 *
 * Stateless by design: both the login link and the session cookie are HMAC
 * payloads, so there is no session table to migrate, expire or leak.
 */

const enc = new TextEncoder();

function b64urlEncode(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(str: string): Uint8Array {
  const pad = str.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(pad + "=".repeat((4 - (pad.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function key(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

/** `<payload>.<sig>` where payload is base64url JSON carrying its own expiry. */
export async function sign(
  secret: string,
  data: Record<string, unknown>,
  ttlSeconds: number,
): Promise<string> {
  const payload = { ...data, exp: Math.floor(Date.now() / 1000) + ttlSeconds };
  const body = b64urlEncode(enc.encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign("HMAC", await key(secret), enc.encode(body));
  return `${body}.${b64urlEncode(new Uint8Array(sig))}`;
}

export async function verify<T = Record<string, unknown>>(
  secret: string,
  token: string,
): Promise<T | null> {
  const dot = token.lastIndexOf(".");
  if (dot < 1) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  try {
    const ok = await crypto.subtle.verify(
      "HMAC",
      await key(secret),
      b64urlDecode(sig),
      enc.encode(body),
    );
    if (!ok) return null;
    const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(body)));
    if (typeof payload.exp !== "number" || payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return payload as T;
  } catch {
    return null;
  }
}

export const SESSION_COOKIE = "coverr_session";
export const LOGIN_TTL = 15 * 60; // link is short-lived; the cookie carries the session
export const SESSION_TTL = 30 * 24 * 60 * 60;

/**
 * The operator's session: its own cookie, sent only to /operador, and a day
 * long rather than a month. It opens every band's buyers and settings, so a
 * forgotten browser should not keep it for weeks.
 */
export const OPERATOR_COOKIE = "coverr_operator";
export const OPERATOR_SESSION_TTL = 12 * 60 * 60;

/**
 * The signing secret. Without one the admin is not safe to serve at all, so
 * this fails loudly rather than signing sessions with a guessable constant.
 */
export function sessionSecret(env: { SESSION_SECRET?: string }): string {
  const secret = env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not configured");
  return secret;
}

/** HttpOnly and SameSite=Lax always: no script reads these, and no other site posts with them. */
function cookieHeader(
  name: string,
  value: string,
  options: { path: string; maxAge: number; secure: boolean },
): string {
  return [
    `${name}=${value}`,
    `Path=${options.path}`,
    "HttpOnly",
    "SameSite=Lax",
    options.secure ? "Secure" : "",
    `Max-Age=${options.maxAge}`,
  ]
    .filter(Boolean)
    .join("; ");
}

export function sessionCookie(token: string, secure: boolean): string {
  return cookieHeader(SESSION_COOKIE, token, { path: "/", maxAge: SESSION_TTL, secure });
}

export function clearCookie(secure: boolean): string {
  return cookieHeader(SESSION_COOKIE, "", { path: "/", maxAge: 0, secure });
}

export function operatorCookie(token: string, secure: boolean): string {
  return cookieHeader(OPERATOR_COOKIE, token, {
    path: "/operador",
    maxAge: OPERATOR_SESSION_TTL,
    secure,
  });
}

export function clearOperatorCookie(secure: boolean): string {
  return cookieHeader(OPERATOR_COOKIE, "", { path: "/operador", maxAge: 0, secure });
}

export function readCookie(header: string | undefined, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return rest.join("=");
  }
  return null;
}
