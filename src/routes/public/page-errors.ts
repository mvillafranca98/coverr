import { Hono } from "hono";
import { reportClientErrors } from "../../jobs/report-client-errors";
import {
  MAX_CLIENT_ERROR_BODY_CHARS,
  pagePattern,
  readClientErrorReports,
} from "../../lib/client-error";
import { clientIp, withinLimit } from "../../lib/rate-limit";
import type { PublicEnv } from "./context";

export const pageErrorRoutes = new Hono<PublicEnv>();

/**
 * Where every page except the scanner reports its own JavaScript failures —
 * the buy form that will not submit on one phone, the ticket page that will
 * not draw its codes. The reporter is inlined by `views/error-reporter.tsx`.
 *
 * There is no credential to ask for: buyers have no account. So the limits are
 * the protection. Per IP, five a minute, because every report can end in an
 * email; the body is capped before it is read; and page reports draw on an
 * alert budget of their own (`alertPool`), so a flood of invented ones can
 * fill a table but never silence a real outage.
 *
 * The page is stored as a pattern (`/boletos/:id`), never as the address it
 * came from — an order id in that address is the key to that order's tickets.
 */
pageErrorRoutes.post("/api/page-error", async (c) => {
  if (!(await withinLimit(c.env.EMAIL_LIMIT, `page-error:${clientIp(c)}`))) {
    return c.json({ error: "rate_limited" }, 429);
  }

  if (Number(c.req.header("Content-Length") ?? 0) > MAX_CLIENT_ERROR_BODY_CHARS) {
    return c.json({ error: "too_large" }, 413);
  }
  const rawBody = await c.req.text();
  if (rawBody.length > MAX_CLIENT_ERROR_BODY_CHARS) return c.json({ error: "too_large" }, 413);

  const { page, reports } = readClientErrorReports({
    rawBody,
    knownTokens: [],
    userAgent: c.req.header("User-Agent") ?? null,
  });
  const path = pagePattern(page) ?? "(unknown page)";
  c.executionCtx.waitUntil(reportClientErrors(c.env, { kind: "page", path, reports }));
  return c.body(null, 204);
});
