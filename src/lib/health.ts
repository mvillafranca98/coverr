import journal from "../../migrations/meta/_journal.json";

/**
 * What the health endpoint reports, and how a single probe is run.
 *
 * The probes themselves live with the route, because each one speaks to a
 * different binding. What is decided here is what counts as an answer: a
 * dependency that throws is down, one that does not answer in time has timed
 * out, and those are reported differently because they send you to different
 * places.
 */

/**
 * `behind` is the database answering but missing the migration this build was
 * written against — the deploy went out before `db:migrate:remote`. Every page
 * that reads still works, and every purchase fails on the missing column.
 */
export type ProbeState = "ok" | "behind" | "down" | "timeout";

export type ProbeResult = { state: ProbeState; error?: unknown };

/**
 * Generous on purpose: a slow but working database paging the operator is how
 * alerts end up ignored. Still well inside a monitor's usual request timeout,
 * so the answer names what hung instead of arriving as a bare timeout.
 */
export const PROBE_TIMEOUT_MS = 5_000;

/**
 * The newest migration in the repo, as wrangler records it in `d1_migrations`.
 *
 * Read from drizzle-kit's journal at build time, so a deploy carries its own
 * expectation of the schema and nobody has to remember to bump a constant.
 * The journal is never empty, and a test holds it to the files actually in
 * `migrations/`.
 */
export const EXPECTED_MIGRATION = `${journal.entries.at(-1)!.tag}.sql`;

/** Runs one probe against a deadline. Never throws. */
export async function runProbe(
  probe: () => Promise<"ok" | "behind">,
  timeoutMs: number = PROBE_TIMEOUT_MS,
): Promise<ProbeResult> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const deadline = new Promise<ProbeResult>((resolve) => {
    timer = setTimeout(() => resolve({ state: "timeout" }), timeoutMs);
  });
  const attempt = probe().then(
    (state): ProbeResult => ({ state }),
    (error: unknown): ProbeResult => ({ state: "down", error }),
  );

  try {
    return await Promise.race([attempt, deadline]);
  } finally {
    clearTimeout(timer);
  }
}
