import { type ChildProcess, execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, openSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import type { TestProject } from "vitest/node";

/**
 * Starts a private Coverr for the end-to-end run: a fresh local database with
 * every migration applied, served on its own port so it never collides with a
 * `npm run dev` already open. Everything it writes stays under
 * .wrangler/e2e-state, which is gitignored and wiped at the start of each run.
 *
 * Mail is never sent and receipts are never sent to the vision model: both
 * fall back to their local stand-ins when their keys are absent, and this
 * refuses to start if they are present, because a test run must not spend
 * money or mail strangers.
 */

const PORT = 8799;
const STATE_DIR = join(".wrangler", "e2e-state");
const LOG_PATH = join(STATE_DIR, "server.log");
const PAID_KEYS = ["ANTHROPIC_API_KEY", "RESEND_API_KEY"];

declare module "vitest" {
  export interface ProvidedContext {
    baseUrl: string;
    logPath: string;
  }
}

/**
 * wrangler's own entry script, run with this Node. Going through npx would need
 * a shell on Windows, where npx is a .cmd file, and a shell joins arguments
 * into one string instead of passing them as they are.
 */
const WRANGLER = join("node_modules", "wrangler", "bin", "wrangler.js");
const wrangler = (args: string[]) => [WRANGLER, ...args];

function refuseIfPaidKeysPresent() {
  if (!existsSync(".dev.vars")) return;
  const vars = readFileSync(".dev.vars", "utf8");
  const present = PAID_KEYS.filter((key) => new RegExp(`^\\s*${key}\\s*=`, "m").test(vars));
  if (present.length > 0) {
    throw new Error(
      `.dev.vars sets ${present.join(" and ")}. The end-to-end run would send real mail or pay ` +
        "for receipt reading; take them out of .dev.vars before running it.",
    );
  }
}

async function waitForHealth(baseUrl: string, server: ChildProcess) {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error(`The local server exited (code ${server.exitCode}); see ${LOG_PATH}`);
    }
    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) return;
    } catch {
      // Not listening yet: keep polling until the deadline.
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error(`The local server did not answer /health within two minutes; see ${LOG_PATH}`);
}

function stop(server: ChildProcess) {
  if (server.exitCode !== null || !server.pid) return;
  // wrangler starts child processes of its own; on Windows only taskkill /t ends them all.
  if (process.platform === "win32") {
    execFileSync("taskkill", ["/pid", String(server.pid), "/t", "/f"], { stdio: "ignore" });
  } else {
    server.kill("SIGTERM");
  }
}

export default async function setup(project: TestProject) {
  refuseIfPaidKeysPresent();

  rmSync(STATE_DIR, { recursive: true, force: true });
  mkdirSync(STATE_DIR, { recursive: true });
  execFileSync(
    process.execPath,
    wrangler(["d1", "migrations", "apply", "coverr-db", "--local", "--persist-to", STATE_DIR]),
    { stdio: "ignore" },
  );

  const log = openSync(LOG_PATH, "a");
  const server = spawn(
    process.execPath,
    wrangler(["dev", "--port", String(PORT), "--persist-to", STATE_DIR]),
    { stdio: ["ignore", log, log] },
  );

  const baseUrl = `http://localhost:${PORT}`;
  await waitForHealth(baseUrl, server);
  project.provide("baseUrl", baseUrl);
  project.provide("logPath", LOG_PATH);

  return () => stop(server);
}
