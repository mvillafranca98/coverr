/**
 * Turns what the door scanner says went wrong into something safe to store
 * and to email.
 *
 * Everything in a client report was written by whatever holds the page, so it
 * is handled as untrusted text: capped, stripped of anything token-shaped, and
 * never interpreted. The alert email escapes it again on the way out.
 */

/** Far beyond any honest batch. Refused before it is parsed. */
export const MAX_CLIENT_ERROR_BODY_CHARS = 20_000;

/** The scanner never queues more than this, so anything past it is not ours. */
export const MAX_REPORTS_PER_BATCH = 5;

const MAX_MESSAGE_CHARS = 500;
const MAX_STACK_CHARS = 3_000;
const MAX_USER_AGENT_CHARS = 200;

export type ClientErrorReport = { message: string; stack: string | null };

/**
 * The staff link and every QR code are capabilities: whoever holds the string
 * can open the scanner or walk in. Either can surface in an error — a stack
 * frame names the page URL, a failed request names the API path — and these
 * reports end in an email.
 *
 * The exact staff token goes first. Then any long run of letters and digits
 * that contains a digit, which is what a random token looks like and what a
 * browser error name such as `OverconstrainedError` — the camera refusing a
 * resolution, precisely the error worth reading — does not.
 */
export function redactTokens(text: string, staffToken: string): string {
  const withoutStaffToken = staffToken ? text.split(staffToken).join(":token") : text;
  return withoutStaffToken.replace(/[0-9A-Za-z]{18,}/g, (run) => (/\d/.test(run) ? "#" : run));
}

/**
 * Reads the batch the scanner posted.
 *
 * Malformed entries are dropped rather than refused: a device reporting that
 * it is broken may be broken in how it reports, and one bad entry must not
 * lose the rest. The device's clock is kept as a line of the stack, because a
 * report queued offline is recorded hours after it happened.
 */
export function readClientErrorReports(input: {
  rawBody: string;
  staffToken: string;
  userAgent: string | null;
}): ClientErrorReport[] {
  const body = parseJson(input.rawBody);
  const entries = isRecord(body) && Array.isArray(body.reports) ? body.reports : [];

  return entries.slice(0, MAX_REPORTS_PER_BATCH).flatMap((entry): ClientErrorReport[] => {
    if (!isRecord(entry) || typeof entry.message !== "string" || !entry.message.trim()) return [];

    const message = redactTokens(entry.message.trim(), input.staffToken).slice(
      0,
      MAX_MESSAGE_CHARS,
    );
    const frames =
      typeof entry.stack === "string"
        ? redactTokens(entry.stack, input.staffToken).slice(0, MAX_STACK_CHARS)
        : "";
    const happenedAt =
      typeof entry.at === "string" && /^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/.test(entry.at)
        ? `On the device at ${entry.at}`
        : "";
    const device = input.userAgent
      ? `Device: ${input.userAgent.slice(0, MAX_USER_AGENT_CHARS)}`
      : "";

    const stack = [frames, happenedAt, device].filter(Boolean).join("\n\n");
    return [{ message, stack: stack || null }];
  });
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
