import { Hono } from "hono";
import { secureHeaders } from "hono/secure-headers";
import { purgeOldErrors } from "./jobs/purge-errors";
import { purgeExpiredProofs } from "./jobs/purge-proofs";
import { reportError } from "./jobs/report-error";
import { sweepExpiredProofFiles } from "./jobs/sweep-proof-files";
import { isCanonicalHost } from "./lib/crawl";
import { hostRedirectTarget } from "./lib/host-redirect";
import { admin } from "./routes/admin";
import { operator } from "./routes/operator";
import { buyRoutes } from "./routes/public/buy";
import { confirmationRoutes } from "./routes/public/confirmation";
import type { Bindings, PublicEnv } from "./routes/public/context";
import { crawlRoutes } from "./routes/public/crawl";
import { healthRoutes } from "./routes/public/health";
import { landingRoutes } from "./routes/public/landing";
import { legalRoutes } from "./routes/public/legal";
import { pageErrorRoutes } from "./routes/public/page-errors";
import { purchaseRoutes } from "./routes/public/purchase";
import { qrFileRoutes } from "./routes/public/qr-files";
import { recoveryRoutes } from "./routes/public/recovery";
import { refundRoutes } from "./routes/public/refunds";
import { scannerShellRoutes } from "./routes/public/scanner-shell";
import { signupRoutes } from "./routes/public/signup";
import { scanApi } from "./routes/scan";
import { scanErrorApi } from "./routes/scan-errors";
import { NotFoundPage, ServerErrorPage } from "./views/errors";

/**
 * The worker's entry point: it assembles the app and owns the two responses
 * that belong to no feature — the 404 and the crash page.
 *
 * Each router below declares its own full paths, so this file is the one place
 * to read the whole URL map. The only ordering that matters is each trailing-
 * slash redirect sitting above its mount, `/admin/` and `/operador/`.
 */
const app = new Hono<PublicEnv>();

/**
 * www and the old workers.dev address send people on to coverr.live — see
 * lib/host-redirect for what they still serve themselves. First, so an old
 * http:// link takes one hop rather than two.
 */
app.use("*", async (c, next) => {
  const target = hostRedirectTarget({
    requestUrl: c.req.url,
    method: c.req.method,
    appOrigin: c.env.APP_ORIGIN,
    redirectHosts: c.env.REDIRECT_HOSTS ?? [],
  });
  return target ? c.redirect(target, 301) : next();
});

/**
 * Security headers on every response, mounted before any route.
 *
 * The CSP allows inline style and script because every page inlines both
 * deliberately — buyers open these on venue wifi moments before paying, and a
 * blocking stylesheet request is a worse failure than the class of attack
 * 'unsafe-inline' leaves open. That tradeoff is written down in DESIGN.md.
 * Nonces would be the stricter answer and are worth doing if the inline
 * blocks ever stop being hand-written constants.
 *
 * Everything else is as tight as the product allows: no framing at all, no
 * object or base tag, images from this origin and data: only (the on-screen
 * QR is a data URI), and form posts only back here.
 */
/**
 * Plain HTTP serves the whole site otherwise, including the buy page — which
 * collects a name, email, phone and an uploaded bank screenshot, and prints
 * the band's account number for the buyer to copy. Over http any of that can
 * be read or rewritten in transit, and a rewritten account number is money
 * sent to the wrong person.
 *
 * Runs before the headers so an http request is answered with the redirect
 * and nothing else.
 */
app.use("*", async (c, next) => {
  const url = new URL(c.req.url);
  if (url.protocol === "http:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
    url.protocol = "https:";
    return c.redirect(url.toString(), 301);
  }
  return next();
});

app.use(
  "*",
  secureHeaders({
    contentSecurityPolicy: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
    },
    // Already HTTPS-only in production; this stops a downgrade being offered.
    strictTransportSecurity: "max-age=15552000; includeSubDomains",
    xContentTypeOptions: "nosniff",
    xFrameOptions: "DENY",
    referrerPolicy: "strict-origin-when-cross-origin",
    crossOriginResourcePolicy: "same-origin",
  }),
);

/**
 * Only the production hostname may be indexed. Version preview URLs serve the
 * whole site, landing page included, and would otherwise compete with the
 * real site in search; the old workers.dev address still serves its QR images
 * itself. A header rather than a robots.txt block, because a crawler has to be
 * let in to read a noindex.
 */
app.use("*", async (c, next) => {
  await next();
  if (!isCanonicalHost(c.req.url, c.env.APP_ORIGIN)) {
    c.res.headers.set("X-Robots-Tag", "noindex, nofollow");
  }
});

app.route("/", buyRoutes);
app.route("/", purchaseRoutes);
app.route("/", confirmationRoutes);
app.route("/", qrFileRoutes);
app.route("/", recoveryRoutes);
app.route("/api/scan", scanApi);
app.route("/api/scan", scanErrorApi);
app.route("/", signupRoutes);
app.route("/", legalRoutes);
app.route("/", refundRoutes);
app.route("/", healthRoutes);
app.route("/", crawlRoutes);
app.route("/", pageErrorRoutes);

app.get("/admin/", (c) => c.redirect("/admin", 301));
app.route("/admin", admin);

app.get("/operador/", (c) => c.redirect("/operador", 301));
app.route("/operador", operator);

app.route("/", scannerShellRoutes);
app.route("/", landingRoutes);

app.notFound((c) => c.html(<NotFoundPage />, 404));

/**
 * Crashes have to reach somebody. The report runs after the response so the
 * buyer waits on nothing, and `c.req.routePath` is the matched pattern rather
 * than the real path — `/t/:token`, not a live QR token. See jobs/report-error.
 */
app.onError((err, c) => {
  c.executionCtx.waitUntil(
    reportError(c.env, {
      kind: "request",
      error: err,
      path: c.req.routePath,
      method: c.req.method,
    }),
  );
  return c.html(<ServerErrorPage />, 500);
});

/**
 * The worker has two entry points: `fetch` for requests, and `scheduled` for
 * the nightly sweeps. Keeping `app` as the fetch handler means every route and
 * the 404/500 pages above are unchanged.
 */
export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledController, env: Bindings, ctx: ExecutionContext) {
    // Each sweep reports its own failure. Nothing is watching a cron run, so
    // without this a job that stopped working would stay stopped — silently,
    // which for the proof purge means third-party banking details quietly
    // outliving their retention window.
    const sweep = (name: string, run: Promise<unknown>) =>
      ctx.waitUntil(
        run.catch((err) => reportError(env, { kind: "scheduled", error: err, path: name })),
      );

    sweep("purge-proofs", purgeExpiredProofs(env));
    sweep("sweep-proof-files", sweepExpiredProofFiles(env));
    sweep("purge-errors", purgeOldErrors(env));
  },
};
