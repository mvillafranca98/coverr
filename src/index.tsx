import { Hono } from "hono";
import { scanApi } from "./routes/scan";
import { admin } from "./routes/admin";
import { purgeExpiredProofs } from "./jobs/purge-proofs";
import type { Bindings } from "./routes/public/context";
import { buyRoutes } from "./routes/public/buy";
import { purchaseRoutes } from "./routes/public/purchase";
import { confirmationRoutes } from "./routes/public/confirmation";
import { qrFileRoutes } from "./routes/public/qr-files";
import { recoveryRoutes } from "./routes/public/recovery";
import { signupRoutes } from "./routes/public/signup";
import { refundRoutes } from "./routes/public/refunds";
import { scannerShellRoutes } from "./routes/public/scanner-shell";
import { landingRoutes } from "./routes/public/landing";
import type { PublicEnv } from "./routes/public/context";

/**
 * The worker's entry point: it assembles the app and owns the two responses
 * that belong to no feature — the 404 and the crash page.
 *
 * Each router below declares its own full paths, so this file is the one place
 * to read the whole URL map. The only ordering that matters is the `/admin/`
 * redirect sitting above the `/admin` mount.
 */
const app = new Hono<PublicEnv>();

app.route("/", buyRoutes);
app.route("/", purchaseRoutes);
app.route("/", confirmationRoutes);
app.route("/", qrFileRoutes);
app.route("/", recoveryRoutes);
app.route("/api/scan", scanApi);
app.route("/", signupRoutes);
app.route("/", refundRoutes);

app.get("/admin/", (c) => c.redirect("/admin", 301));
app.route("/admin", admin);

app.route("/", scannerShellRoutes);
app.route("/", landingRoutes);

app.notFound((c) =>
  c.html(
    `<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1">
     <body style="font-family:system-ui;background:#0C0B09;color:#F6F2EB;padding:48px 24px;text-align:center">
     <h1>No encontramos esta página</h1>
     <p style="color:#A79E90">Revisá el enlace que te compartieron.</p></body>`,
    404,
  ),
);

app.onError((err, c) => {
  console.error(`unhandled: ${err instanceof Error ? err.stack ?? err.message : String(err)}`);
  return c.html(
    `<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1">
     <body style="font-family:system-ui;background:#0C0B09;color:#F6F2EB;padding:48px 24px;text-align:center">
     <h1>Algo salió mal</h1>
     <p style="color:#A79E90">Volvé a intentarlo. Si ya transferiste, escribinos y lo resolvemos.</p></body>`,
    500,
  );
});

/**
 * The worker has two entry points now: `fetch` for requests, and `scheduled`
 * for the nightly proof purge. Keeping `app` as the fetch handler means every
 * route and the 404/500 pages above are unchanged.
 */
export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledController, env: Bindings, ctx: ExecutionContext) {
    ctx.waitUntil(purgeExpiredProofs(env));
  },
};
