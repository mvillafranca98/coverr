#!/usr/bin/env node
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

/**
 * Deploys with the commit it came from written on the version.
 *
 * Exists for rollbacks. `wrangler deployments list` showed every version with
 * the message and tag "-", so choosing which one to roll back to meant
 * matching timestamps against git log at the worst possible moment. Now each
 * version carries its short hash as the tag and the commit subject as the
 * message, and the list reads like `git log`.
 *
 *   npm run deploy
 *   npm run deploy -- --dry-run      # anything after -- goes to wrangler
 *
 * A deploy with uncommitted changes says so in its message, because that
 * version matches no commit and a rollback to it brings back code that exists
 * nowhere else.
 *
 * Calls wrangler's own entry point through node rather than `npx`, so the
 * message reaches it as one argument on every platform, spaces and quotes
 * included, with no shell in between.
 */

/** Cloudflare caps a rollback message at 120; versions get the safer 100. */
const MAX_MESSAGE_CHARS = 100;

const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();

const hash = git("rev-parse", "--short", "HEAD");
const subject = git("log", "-1", "--format=%s");
const dirty = git("status", "--porcelain") !== "";
const message = `${hash} ${subject}${dirty ? " (+ uncommitted changes)" : ""}`.slice(
  0,
  MAX_MESSAGE_CHARS,
);

console.log(`Deploying as version tag ${hash}: "${message}"`);

const wrangler = fileURLToPath(
  new URL("../node_modules/wrangler/bin/wrangler.js", import.meta.url),
);
const result = spawnSync(
  process.execPath,
  [wrangler, "deploy", "--message", message, "--tag", hash, ...process.argv.slice(2)],
  { stdio: "inherit" },
);

if (result.error) {
  console.error(`Could not start wrangler: ${result.error.message}`);
  process.exit(1);
}
process.exit(result.status ?? 1);
