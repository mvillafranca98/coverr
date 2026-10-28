/**
 * Turns what a browser says went wrong into something safe to store and to
 * email.
 *
 * Everything in a client report was written by whatever holds the page, so it
 * is handled as untrusted text: capped, stripped of anything token-shaped, and
 * never interpreted. The alert email escapes it again on the way out.
 */

/** Far beyond any honest batch. Refused before it is parsed. */
export const MAX_CLIENT_ERROR_BODY_CHARS = 20_000;

/** No reporter ever sends more than this, so anything past it is not ours. */
export const MAX_REPORTS_PER_BATCH = 5;

const MAX_MESSAGE_CHARS = 500;
const MAX_STACK_CHARS = 3_000;
const MAX_USER_AGENT_CHARS = 200;

export type ClientErrorReport = { message: string; stack: string | null };

/**
 * Removes capabilities from text bound for a stored row and an email.
 *
 * Several strings in this product are keys rather than names: the scanner's
 * staff link opens the door app, a QR token gets somebody in, and an order id
 * in `/boletos/…` shows that order's tickets. Any of them can surface in an
 * error — a stack frame names the page URL, a failed request names its path.
 *
 * Tokens the caller already knows go first, exactly. Then any run of twelve
 * or more letters and digits that contains a digit, which covers every id and
 * token this product generates (an order id's random part is sixteen) and
 * spares browser error names such as `OverconstrainedError` — the camera
 * refusing a resolution, precisely the error worth reading.
 */
export function redactTokens(text: string, knownTokens: string[]): string {
  const withoutKnown = knownTokens
    .filter((token) => token.length > 0)
    .reduce((current, token) => current.split(token).join(":token"), text);
  return withoutKnown.replace(/[0-9A-Za-z]{12,}/g, (run) => (/\d/.test(run) ? "#" : run));
}

/**
 * A page's path with everything that identifies a person or an order taken
 * out, so it can be stored, grouped and emailed: `/boletos/ord_m2h8x1q4b7z9kk`
 * becomes `/boletos/:id`.
 *
 * Only plain lowercase words survive — route names, and event slugs, which
 * are public. Anything else in a segment (digits, capitals, underscores,
 * encoded characters) becomes `:id`. Null when the browser sent something
 * that is not a path at all.
 */
export function pagePattern(pathname: unknown): string | null {
  if (typeof pathname !== "string" || !pathname.startsWith("/") || pathname.length > 300) {
    return null;
  }
  const segments = pathname
    .split("/")
    .filter(Boolean)
    .slice(0, 6)
    .map((segment) => (/^[a-z-]{1,40}$/.test(segment) ? segment : ":id"));
  return `/${segments.join("/")}`;
}

/**
 * Reads a batch a browser posted: the reports, and the page it says it was on
 * (`page`, still raw — pass it through `pagePattern`).
 *
 * Malformed entries are dropped rather than refused: a page reporting that it
 * is broken may be broken in how it reports, and one bad entry must not lose
 * the rest. The device's clock is kept as a line of the stack, because a
 * report queued offline is recorded hours after it happened.
 */
export function readClientErrorReports(input: {
  rawBody: string;
  knownTokens: string[];
  userAgent: string | null;
}): { page: unknown; reports: ClientErrorReport[] } {
  const body = parseJson(input.rawBody);
  if (!isRecord(body)) return { page: null, reports: [] };
  const entries = Array.isArray(body.reports) ? body.reports : [];

  const reports = entries.slice(0, MAX_REPORTS_PER_BATCH).flatMap((entry): ClientErrorReport[] => {
    if (!isRecord(entry) || typeof entry.message !== "string" || !entry.message.trim()) {
      return [];
    }

    const message = redactTokens(entry.message.trim(), input.knownTokens).slice(
      0,
      MAX_MESSAGE_CHARS,
    );
    const frames =
      typeof entry.stack === "string"
        ? redactTokens(entry.stack, input.knownTokens).slice(0, MAX_STACK_CHARS)
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

  return { page: body.page, reports };
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
