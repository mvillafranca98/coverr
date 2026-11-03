/**
 * Hostnames that answer with a redirect to APP_ORIGIN instead of serving the
 * site: `www.`, and the workers.dev address Coverr ran on before it had a
 * domain. Every ticket email, sign-in link and staff scanner link sent before
 * the move points at that address, so it keeps answering for good.
 */

/** Paths a redirected host still serves itself. See `hostRedirectTarget`. */
const SERVED_IN_PLACE = ["/api/", "/t/"] as const;

/**
 * The same path and query on APP_ORIGIN when the request came to one of
 * `redirectHosts`, or null when it should be answered where it is.
 *
 * Left alone even on a redirected host:
 * - Anything but GET or HEAD. A 301 turns a POST into a GET, so a form sent
 *   from a page loaded before the move would arrive empty.
 * - `/api/`: a door scanner opened before the move keeps syncing with the
 *   origin it loaded from. A fetch redirected to another origin fails as a
 *   CORS error, and the scanner would read as offline in the middle of a night.
 * - `/t/`: the QR images inside emails already sent. Not every mail client's
 *   image proxy follows a redirect, and a QR that fails to load is a buyer at
 *   the door with nothing to show.
 *
 * The target keeps the request's path rather than resolving it against the
 * origin, because a path of `//elsewhere.com` would resolve to another site.
 */
export function hostRedirectTarget(input: {
  requestUrl: string;
  method: string;
  appOrigin: string;
  redirectHosts: readonly string[];
}): string | null {
  const target = new URL(input.requestUrl);
  if (!input.redirectHosts.includes(target.host)) return null;
  if (input.method !== "GET" && input.method !== "HEAD") return null;
  if (SERVED_IN_PLACE.some((prefix) => target.pathname.startsWith(prefix))) return null;

  let origin: URL;
  try {
    origin = new URL(input.appOrigin);
  } catch {
    // Nowhere valid to send it. Serving the old host beats failing every request to it.
    return null;
  }
  // APP_ORIGIN's own host in the list would send every page to itself, forever.
  if (origin.host === target.host) return null;

  target.protocol = origin.protocol;
  target.host = origin.host;
  return target.toString();
}
