import { and, eq, gte, isNotNull, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import * as s from "../db/schema";
import { newId, nowIso } from "../lib/core";
import { makeTransport } from "../lib/email";
import { errorAlertEmailHtml, errorAlertEmailSubject, errorAlertEmailText } from "../views/email";

type Env = {
  DB: D1Database;
  PROOFS?: R2Bucket;
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
  /** Where crash alerts go. Unset means record only, and say so in the log. */
  ALERT_EMAIL?: string;
};

/** How long one error stays quiet after it has alerted once. */
export const ALERT_WINDOW_MINUTES = 60;

/**
 * The most alerts one window may produce, across every distinct error.
 *
 * The claim key below handles one bug failing repeatedly. This handles the
 * other shape: a deploy that breaks six routes at once, where six separate
 * emails say nothing the first one did not.
 */
export const ALERT_CAP_PER_WINDOW = 5;

/** Long enough to find the bug, short enough to survive an email client. */
const MAX_STACK_CHARS = 4000;
const MAX_MESSAGE_CHARS = 1000;

/**
 * Collapses one bug into one string, so the same failure seen two hundred
 * times in a night is recognised as the same failure.
 *
 * Numbers are dropped because the volatile part of a message is almost always
 * numeric — ids, timestamps, row counts, statuses. `order ord_m2h8x1 not
 * found` and `order ord_q4b7z9 not found` are one bug and must not alert
 * twice. Nothing is lost: the full message is stored next to the fingerprint.
 */
export function errorFingerprint(input: {
  kind: string;
  path: string | null;
  message: string;
}): string {
  const [firstLine = ""] = input.message.split("\n");
  const normalized = firstLine
    .toLowerCase()
    // Any long run mixing letters and digits is an id: `newId` builds them
    // from base36 millis and base32 random, so a hex-only rule would miss
    // most of them. Short runs are left alone — `d1_error` is not an id.
    .replace(/[a-z0-9]*\d[a-z0-9]*/g, (run) => (run.length >= 6 ? "#" : run))
    .replace(/\d+/g, "#")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
  return `${input.kind}|${input.path ?? "-"}|${normalized}`;
}

/**
 * The whole dedupe policy in one value: this bug, this window.
 *
 * Written into a unique column, so winning the right to send an alert is an
 * insert that either succeeds or is refused — see the `alertClaim` comment in
 * the schema for why counting rows instead would not hold.
 *
 * Windows are fixed rather than sliding, which is why the email says "up to":
 * an error at :59 and the same one at :01 fall either side of a boundary and
 * both alert. Cheap to compute, and erring toward one extra email is the right
 * direction for the only mail that reports the product being broken.
 */
export function alertClaimKey(input: { nowMs: number; fingerprint: string }): string {
  const window = Math.floor(input.nowMs / (ALERT_WINDOW_MINUTES * 60_000));
  return `${window}|${input.fingerprint}`;
}

export type ErrorReport = {
  /** `client` is a browser reporting its own failure — see routes/scan-errors. */
  kind: "request" | "scheduled" | "client";
  error: unknown;
  /**
   * The matched route pattern — `/t/:token`, never `/t/abc123.png`. A real
   * pathname would carry a live QR token into a row that also goes out by
   * email. See the `error_log` schema.
   */
  path?: string | null;
  method?: string | null;
};

/**
 * Records an unhandled failure and, the first time it is seen, emails it.
 *
 * Cloudflare already keeps the console output, but a dashboard is somewhere
 * you have to go and look, and a worker that starts failing at nine on a gig
 * night has to interrupt somebody. This is that interruption.
 *
 * Nothing in here throws. It runs from `waitUntil` after the 500 has already
 * gone to the buyer, and a reporter that can itself fail turns one broken
 * request into two.
 */
export async function reportError(env: Env, report: ErrorReport): Promise<void> {
  const err = report.error;
  const message = (err instanceof Error ? err.message : String(err)).slice(0, MAX_MESSAGE_CHARS);
  const stack = err instanceof Error && err.stack ? err.stack.slice(0, MAX_STACK_CHARS) : null;
  const path = report.path ?? null;

  // Goes out whatever happens below, because it is the one thing that still
  // works when the database does not.
  console.error(
    `[error] ${report.kind} ${report.method ?? ""} ${path ?? ""} — ${stack ?? message}`,
  );

  const db = drizzle(env.DB, { schema: s });
  const row = {
    id: newId("err"),
    at: nowIso(),
    kind: report.kind,
    fingerprint: errorFingerprint({ kind: report.kind, path, message }),
    message,
    stack,
    path,
    method: report.method ?? null,
  };

  const claim = (await withinWindowCap(db))
    ? alertClaimKey({ nowMs: Date.now(), fingerprint: row.fingerprint })
    : null;

  if (claim === null) {
    await record(db, row, null);
    return;
  }

  // Claiming and recording are the same insert. If it is refused — because
  // another request is already alerting about this bug, or because the
  // database is unreachable — the occurrence is recorded without a claim and
  // no mail goes out. Both reasons point the same way: stay quiet.
  const claimed = await record(db, row, claim);
  if (!claimed) {
    await record(db, row, null);
    return;
  }

  const sent = await sendAlert(env, row);
  if (sent) {
    await markNotified(db, row.id);
  }
}

type Row = {
  id: string;
  at: string;
  kind: string;
  fingerprint: string;
  message: string;
  stack: string | null;
  path: string | null;
  method: string | null;
};

/**
 * Whether the window has room for another alert.
 *
 * False when the database cannot be reached, which suppresses the mail
 * deliberately: an outage fails every request, and alerting on each one would
 * burn the day's Resend quota — the same quota that delivers tickets. Tickets
 * outrank alerts, and a total outage is what the uptime check is for.
 */
async function withinWindowCap(db: ReturnType<typeof drizzle>): Promise<boolean> {
  const windowStart = new Date(Date.now() - ALERT_WINDOW_MINUTES * 60_000).toISOString();
  try {
    const [counted] = await db
      .select({ n: sql<number>`count(*)` })
      .from(s.errorLog)
      .where(and(isNotNull(s.errorLog.alertClaim), gte(s.errorLog.at, windowStart)));
    return Number(counted?.n ?? 0) < ALERT_CAP_PER_WINDOW;
  } catch (dbErr) {
    console.error(`[error] could not reach error_log, alert suppressed: ${String(dbErr)}`);
    return false;
  }
}

/** Writes the occurrence. Returns false if the insert was refused. */
async function record(
  db: ReturnType<typeof drizzle>,
  row: Row,
  alertClaim: string | null,
): Promise<boolean> {
  try {
    await db.insert(s.errorLog).values({ ...row, alertClaim, notified: 0 });
    return true;
  } catch (dbErr) {
    if (alertClaim === null) {
      console.error(`[error] could not write error_log: ${String(dbErr)}`);
    }
    return false;
  }
}

async function markNotified(db: ReturnType<typeof drizzle>, id: string): Promise<void> {
  try {
    await db.update(s.errorLog).set({ notified: 1 }).where(eq(s.errorLog.id, id));
  } catch (dbErr) {
    console.error(`[error] alert sent but could not be marked: ${String(dbErr)}`);
  }
}

async function sendAlert(env: Env, row: Row): Promise<boolean> {
  if (!env.ALERT_EMAIL) {
    console.error("[error] ALERT_EMAIL unset — crash recorded but nobody was told");
    return false;
  }

  const mail = {
    at: row.at,
    kind: row.kind,
    path: row.path,
    method: row.method,
    message: row.message,
    stack: row.stack,
    quietMinutes: ALERT_WINDOW_MINUTES,
  };

  const result = await makeTransport(env).send({
    to: env.ALERT_EMAIL,
    subject: errorAlertEmailSubject(mail),
    html: errorAlertEmailHtml(mail),
    text: errorAlertEmailText(mail),
  });

  if (!result.ok) {
    console.error(`[error] alert could not be sent: ${result.error}`);
    return false;
  }
  console.log(`[error] alerted ${env.ALERT_EMAIL} about ${row.fingerprint}`);
  return true;
}
