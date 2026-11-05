import { drizzle } from "drizzle-orm/d1";
import { Hono, type MiddlewareHandler } from "hono";
import { findBand, listBandsByEmail } from "../../db/queries/bands";
import { isSignInLinkSpent, spendSignInLink } from "../../db/queries/sign-in-links";
import * as s from "../../db/schema";
import { mailBandSignInLink } from "../../jobs/mail-band-links";
import { sendSuspendedNotice } from "../../jobs/notify-suspended";
import {
  clearCookie,
  readCookie,
  SESSION_COOKIE,
  SESSION_TTL,
  sessionCookie,
  sessionSecret,
  sign,
  verify,
} from "../../lib/auth";
import { decideSignIn, signInTitle } from "../../lib/band-identity";
import { normalizeEmail, nowIso } from "../../lib/core";
import { clientIp, TOO_MANY_REQUESTS, withinLimit } from "../../lib/rate-limit";
import {
  bandFromSession,
  bandSessionPayload,
  emailFromLoginLink,
  emailFromSession,
  linkToSpend,
} from "../../lib/sign-in";
import { LoginPage, SignInConfirmPage } from "../../views/admin/login";
import type { AdminContext, AdminEnv } from "./context";

const isHttps = (origin: string) => origin.startsWith("https://");

/** The only admin paths reachable without a session — everything signing in or creating a band needs. */
const PUBLIC_PATHS = new Set([
  "/admin/acceso",
  "/admin/login",
  "/admin/entrar",
  "/admin/crear",
  "/admin/salir",
]);

export const EXPIRED_LINK = "Ese enlace ya venció. Pedí uno nuevo.";
export const SPENT_LINK = "Ese enlace ya se usó. Pedí uno nuevo si querés entrar otra vez.";

/**
 * Opens a session on `bandId` for `email`, the address that proved itself by
 * opening a link. Every way into a band ends here: signing in, creating one,
 * and switching between a person's bands.
 */
export async function openSession(c: AdminContext, bandId: string, email: string, to: string) {
  const session = await sign(sessionSecret(c.env), bandSessionPayload(bandId, email), SESSION_TTL);
  c.header("Set-Cookie", sessionCookie(session, isHttps(c.env.APP_ORIGIN)));
  return c.redirect(to, 303);
}

/**
 * Gate for everything under /admin. Registered on the parent router before any
 * feature router, so `c.get("bandId")` is always populated downstream.
 */
export const requireSession: MiddlewareHandler<AdminEnv> = async (c, next) => {
  const path = new URL(c.req.url).pathname;
  if (PUBLIC_PATHS.has(path)) return next();

  const raw = readCookie(c.req.header("Cookie"), SESSION_COOKIE);
  if (!raw) return c.redirect("/admin/acceso", 302);
  const payload = await verify(sessionSecret(c.env), raw);
  const bandId = bandFromSession(payload);
  if (!bandId) return c.redirect("/admin/acceso", 302);

  // A signed session outlives its band when the band deletes its account from
  // another device, and so does a sign-in link sent just before. Without this
  // check every write in the admin would hit a foreign key that no longer
  // exists and crash; with it, the session just ends.
  const band = await findBand(drizzle(c.env.DB, { schema: s }), bandId);
  if (!band) return c.redirect("/admin/salir", 302);

  // A ban ends the session on the band's next click, not when its cookie runs
  // out a month later.
  if (band.bannedAt) {
    c.header("Set-Cookie", clearCookie(isHttps(c.env.APP_ORIGIN)));
    return c.redirect("/admin/acceso?suspendida=1", 302);
  }

  c.set("bandId", bandId);
  c.set("signedInEmail", emailFromSession(payload));
  return next();
};

export const sessionRoutes = new Hono<AdminEnv>();

sessionRoutes.get("/acceso", (c) =>
  c.html(
    <LoginPage sent={c.req.query("ok") === "1"} suspended={c.req.query("suspendida") === "1"} />,
  ),
);

/**
 * Mails a sign-in link to whoever runs bands under the address. The answer is
 * the same whether it runs none, one or several — otherwise this page tells
 * anyone which addresses run a band. Suspended bands are never offered; an
 * address whose bands are all suspended gets the reason by mail instead.
 */
sessionRoutes.post("/login", async (c) => {
  if (!(await withinLimit(c.env.EMAIL_LIMIT, `mail:${clientIp(c)}`))) {
    return c.html(<LoginPage error={TOO_MANY_REQUESTS} />, 429);
  }

  const body = await c.req.parseBody();
  const email = typeof body["email"] === "string" ? normalizeEmail(body["email"]) : "";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return c.html(<LoginPage error="Revisá el correo que escribiste." />, 400);
  }

  const db = drizzle(c.env.DB, { schema: s });
  const decision = decideSignIn(await listBandsByEmail(db, email));
  if (decision.kind === "suspended") {
    c.executionCtx.waitUntil(sendSuspendedNotice(c.env, { ...decision.band, contactEmail: email }));
  } else if (decision.kind === "open") {
    c.executionCtx.waitUntil(mailBandSignInLink(c.env, email, signInTitle(decision.bands)));
  }
  return c.redirect("/admin/acceso?ok=1", 303);
});

/** What a sign-in link opens now, checked again on landing and on the tap. */
async function readSignInLink(c: AdminContext, token: string) {
  const payload = await verify(sessionSecret(c.env), token);
  const email = emailFromLoginLink(payload);
  const link = linkToSpend(payload);
  if (!email || !link) return null;
  const db = drizzle(c.env.DB, { schema: s });
  return { email, link, db, decision: decideSignIn(await listBandsByEmail(db, email)) };
}

/**
 * A sign-in link opens a page with one button rather than the panel itself:
 * mail filters open links to scan them, and the link is spent on the tap, not
 * on the opening. Says so up front when the link is already spent.
 */
sessionRoutes.get("/entrar", async (c) => {
  const token = c.req.query("t");
  if (!token) return c.redirect("/admin/acceso", 302);

  const signIn = await readSignInLink(c, token);
  if (!signIn || signIn.decision.kind === "none") {
    return c.html(<LoginPage error={EXPIRED_LINK} />, 400);
  }
  // A link sent before a ban must not open a session after it.
  if (signIn.decision.kind === "suspended") return c.html(<LoginPage suspended />, 403);
  if (await isSignInLinkSpent(signIn.db, signIn.link.linkId)) {
    return c.html(<LoginPage error={SPENT_LINK} />, 400);
  }
  return c.html(<SignInConfirmPage bandName={signInTitle(signIn.decision.bands)} token={token} />);
});

/**
 * Spends the link and opens a session. One band goes straight in; several open
 * the oldest and land on the list to choose from. A second tap is refused.
 */
sessionRoutes.post("/entrar", async (c) => {
  const token = String((await c.req.parseBody())["t"] ?? "");
  const signIn = token ? await readSignInLink(c, token) : null;
  if (!signIn || signIn.decision.kind === "none") {
    return c.html(<LoginPage error={EXPIRED_LINK} />, 400);
  }
  if (signIn.decision.kind === "suspended") return c.html(<LoginPage suspended />, 403);
  if (!(await spendSignInLink(signIn.db, signIn.link, nowIso()))) {
    return c.html(<LoginPage error={SPENT_LINK} />, 400);
  }

  const bands = signIn.decision.bands;
  const first = bands[0];
  if (!first) return c.html(<LoginPage error={EXPIRED_LINK} />, 400);
  return openSession(c, first.id, signIn.email, bands.length > 1 ? "/admin/bandas" : "/admin");
});

sessionRoutes.get("/salir", (c) => {
  c.header("Set-Cookie", clearCookie(isHttps(c.env.APP_ORIGIN)));
  return c.redirect("/admin/acceso", 302);
});
