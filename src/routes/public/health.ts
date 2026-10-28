import { Hono } from "hono";
import { migrationApplied } from "../../db/queries/health";
import { EXPECTED_MIGRATION, type ProbeResult, runProbe } from "../../lib/health";
import type { Bindings, PublicEnv } from "./context";

export const healthRoutes = new Hono<PublicEnv>();

/**
 * A key that never exists. `head` on it is a real round trip to the bucket
 * that reads no proof and writes nothing — one class B operation, no PII.
 */
const PROOFS_PROBE_KEY = "health/probe";

/**
 * For an external uptime monitor: 200 when every dependency a purchase needs
 * answers, 503 naming the one that did not.
 *
 * `/` cannot do this job. It renders without touching D1 or R2, so it stays
 * green through a complete database outage while every buy page fails.
 *
 * Only D1 and R2 are probed. Email and proof extraction run after the
 * response, the QR issues without them, and their failures already reach the
 * operator through report-error. Probing them here would also mean a paid
 * vision call every few minutes.
 *
 * The body says which dependency failed and nothing else — no versions, no
 * counts, no error text. The detail goes to the log.
 */
healthRoutes.get("/health", async (c) => {
  const [database, proofs] = await Promise.all([
    runProbe(() => probeDatabase(c.env)),
    runProbe(() => probeProofs(c.env)),
  ]);
  logFailures({ database, proofs });

  const healthy = database.state === "ok" && proofs.state === "ok";
  return c.json(
    { ok: healthy, database: database.state, proofs: proofs.state },
    healthy ? 200 : 503,
    { "Cache-Control": "no-store" },
  );
});

async function probeDatabase(env: Bindings): Promise<"ok" | "behind"> {
  return (await migrationApplied(env.DB, EXPECTED_MIGRATION)) ? "ok" : "behind";
}

async function probeProofs(env: Bindings): Promise<"ok"> {
  await env.PROOFS.head(PROOFS_PROBE_KEY);
  return "ok";
}

function logFailures(results: Record<string, ProbeResult>): void {
  for (const [name, result] of Object.entries(results)) {
    if (result.state === "ok") continue;
    const detail = result.state === "behind" ? `expected ${EXPECTED_MIGRATION}` : result.error;
    console.error(`[health] ${name}=${result.state}`, detail ?? "");
  }
}
