import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * The files in `migrations/` that a D1 database has not applied yet.
 *
 * Exists so a deploy cannot go out ahead of its migration. When one did, the
 * new code read a column that was not there and every event page failed
 * until the migration ran. `/health` reports that state as `behind`, but only
 * once the broken code is already live; this answers before anything ships.
 *
 * Compares file names with `d1_migrations`, the table wrangler writes as it
 * applies each file, so "pending" means exactly what `wrangler d1 migrations
 * apply` would run next.
 */

const DATABASE = "coverr-db";
const MIGRATIONS_DIR = new URL("../migrations/", import.meta.url);
const WRANGLER = fileURLToPath(
  new URL("../node_modules/wrangler/bin/wrangler.js", import.meta.url),
);

/**
 * @param {"--remote" | "--local"} location which copy of the database to ask
 * @returns {{ ok: true, pending: string[] } | { ok: false, reason: string }}
 *   `ok: false` when the database could not be read; the caller decides what
 *   an unanswered check means, and a deploy treats it as a stop.
 */
export function pendingMigrations(location) {
  const query = spawnSync(
    process.execPath,
    [
      WRANGLER,
      "d1",
      "execute",
      DATABASE,
      location,
      "--json",
      "--command",
      "SELECT name FROM d1_migrations",
    ],
    { encoding: "utf8" },
  );
  if (query.error) return { ok: false, reason: `Could not start wrangler: ${query.error.message}` };

  const answer = parseJson(query.stdout);
  if (query.status !== 0 || !Array.isArray(answer)) {
    const reason =
      describeWranglerError(answer?.error) ||
      (query.stderr || query.stdout).trim() ||
      `wrangler exited with ${query.status}`;
    return { ok: false, reason };
  }

  const applied = new Set(answer.flatMap((statement) => statement.results.map((row) => row.name)));
  const pending = readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith(".sql") && !applied.has(file))
    .sort();
  return { ok: true, pending };
}

/**
 * A failed Cloudflare request puts only the URL in `text`; what Cloudflare
 * answered, with its error code, is in `notes`, and that is the part that
 * says what to fix.
 */
function describeWranglerError(error) {
  if (!error) return "";
  const notes = (error.notes ?? []).map((note) => note.text);
  return [error.text, ...notes].filter(Boolean).join("\n");
}

/** Wrangler prints its JSON on stdout, but a login prompt or crash may not be JSON. */
function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
