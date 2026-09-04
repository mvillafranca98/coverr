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

export function sessionCookie(token: string, secure: boolean): string {
  return [
    `${SESSION_COOKIE}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    secure ? "Secure" : "",
    `Max-Age=${SESSION_TTL}`,
  ]
    .filter(Boolean)
    .join("; ");
}

export function clearCookie(secure: boolean): string {
  return [
    `${SESSION_COOKIE}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    secure ? "Secure" : "",
    "Max-Age=0",
  ]
    .filter(Boolean)
    .join("; ");
}

export function readCookie(header: string | undefined, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return rest.join("=");
  }
  return null;
}
