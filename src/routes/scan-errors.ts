import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import { findEventByStaffToken } from "../db/queries/events";
import * as s from "../db/schema";
import { reportError } from "../jobs/report-error";
import {
  type ClientErrorReport,
  MAX_CLIENT_ERROR_BODY_CHARS,
  readClientErrorReports,
} from "../lib/client-error";
import { withinLimit } from "../lib/rate-limit";
import type { Bindings, PublicEnv } from "./public/context";

export const scanErrorApi = new Hono<PublicEnv>();

/**
 * Where the door scanner reports its own failures.
 *
 * A scanner that breaks mid-queue is invisible to everyone but the person
 * holding it, and they are busy. This hands those errors to the same reporter
 * the server's crashes use, so they land in `error_log` and in the operator's
 * inbox.
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

  // Keyed by event, never by token: the limiter logs its key when it fails.
  if (!(await withinLimit(c.env.EMAIL_LIMIT, `scanner-error:${found.event.id}`))) {
    return c.json({ error: "rate_limited" }, 429);
  }

  if (Number(c.req.header("Content-Length") ?? 0) > MAX_CLIENT_ERROR_BODY_CHARS) {
    return c.json({ error: "too_large" }, 413);
  }
  const rawBody = await c.req.text();
  if (rawBody.length > MAX_CLIENT_ERROR_BODY_CHARS) return c.json({ error: "too_large" }, 413);

  const reports = readClientErrorReports({
    rawBody,
    staffToken: token,
    userAgent: c.req.header("User-Agent") ?? null,
  });
  c.executionCtx.waitUntil(recordReports(c.env, reports));
  return c.body(null, 204);
});

/** One at a time — at most five — so a burst is a handful of small writes. */
async function recordReports(env: Bindings, reports: ClientErrorReport[]): Promise<void> {
  for (const report of reports) {
    await reportError(env, { kind: "client", error: asError(report), path: "scanner" });
  }
}

/**
 * The reporter reads message and stack off an Error. The stack a fresh Error
 * gets here would point at this file, so it is replaced with the device's —
 * or emptied, which the reporter stores as no stack at all.
 */
function asError(report: ClientErrorReport): Error {
  const error = new Error(report.message);
  error.stack = report.stack ?? "";
  return error;
}
