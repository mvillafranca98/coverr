import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import { findEventByStaffToken } from "../db/queries/events";
import * as s from "../db/schema";
import { reportClientErrors } from "../jobs/report-client-errors";
import { MAX_CLIENT_ERROR_BODY_CHARS, readClientErrorReports } from "../lib/client-error";
import { doorAccess } from "../lib/door-window";
import { withinLimit } from "../lib/rate-limit";
import type { PublicEnv } from "./public/context";

export const scanErrorApi = new Hono<PublicEnv>();

/**
 * Where the door scanner reports its own failures.
 *
 * A scanner that breaks mid-queue is invisible to everyone but the person
 * holding it, and they are busy. This hands those errors to the same reporter
 * the server's crashes use, so they land in `error_log` and in the operator's
 * inbox, under an alert budget of their own.
 *
 * Authorised by the staff token like the rest of the scanner API: only a
 * device that was given the link can post here. Rate-limited per event because
 * every report can end in an email; the scanner throttles itself as well, and
 * keeps whatever is refused for its next sync. Answers before recording.
 */
scanErrorApi.post("/:token/error", async (c) => {
  const token = c.req.param("token");
  const db = drizzle(c.env.DB, { schema: s });
  const found = await findEventByStaffToken(db, token);
  if (!found) return c.json({ error: "not_found" }, 404);
  if (doorAccess(found.event.startsAt, new Date()) === "closed") {
    return c.json({ error: "event_over" }, 410);
  }

  // Keyed by event, never by token: the limiter logs its key when it fails.
  if (!(await withinLimit(c.env.EMAIL_LIMIT, `scanner-error:${found.event.id}`))) {
    return c.json({ error: "rate_limited" }, 429);
  }

  if (Number(c.req.header("Content-Length") ?? 0) > MAX_CLIENT_ERROR_BODY_CHARS) {
    return c.json({ error: "too_large" }, 413);
  }
  const rawBody = await c.req.text();
  if (rawBody.length > MAX_CLIENT_ERROR_BODY_CHARS) return c.json({ error: "too_large" }, 413);

  const { reports } = readClientErrorReports({
    rawBody,
    knownTokens: [token],
    userAgent: c.req.header("User-Agent") ?? null,
  });
  c.executionCtx.waitUntil(
    reportClientErrors(c.env, { kind: "scanner", path: "/scan/:token", reports }),
  );
  return c.body(null, 204);
});
