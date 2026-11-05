import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Hono, type MiddlewareHandler } from "hono";
import { findBand } from "../../db/queries/bands";
import { isSignInLinkSpent, spendSignInLink } from "../../db/queries/sign-in-links";
import * as s from "../../db/schema";
import { sendSuspendedNotice } from "../../jobs/notify-suspended";
import {
  clearCookie,
  LOGIN_TTL,
  readCookie,
  SESSION_COOKIE,
  SESSION_TTL,
  sessionCookie,
  sessionSecret,
  sign,
  verify,
} from "../../lib/auth";
import { normalizeEmail, nowIso } from "../../lib/core";
import { makeTransport } from "../../lib/email";
import { clientIp, TOO_MANY_REQUESTS, withinLimit } from "../../lib/rate-limit";
import {
  bandFromLoginLink,
  bandFromSession,
  bandLoginPayload,
  bandSessionPayload,
  linkToSpend,
} from "../../lib/sign-in";
import { LoginPage, SignInConfirmPage } from "../../views/admin/login";
import { LOGIN_EMAIL_SUBJECT, loginEmailHtml, loginEmailText } from "../../views/email";
import type { AdminEnv } from "./context";

const isHttps = (origin: string) => origin.startsWith("https://");

/** The only admin paths reachable without a session — everything sign-in needs. */
const PUBLIC_PATHS = new Set(["/admin/acceso", "/admin/login", "/admin/entrar", "/admin/salir"]);

/**
 * Gate for everything under /admin. Registered on the parent router before any
 * feature router, so `c.get("bandId")` is always populated downstream.
 */
export const requireSession: MiddlewareHandler<AdminEnv> = async (c, next) => {
  const path = new URL(c.req.url).pathname;
  if (PUBLIC_PATHS.has(path)) return next();

  const raw = readCookie(c.req.header("Cookie"), SESSION_COOKIE);
  if (!raw) return c.redirect("/admin/acceso", 302);
  const bandId = bandFromSession(await verify(sessionSecret(c.env), raw));
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
  return next();
};

export const sessionRoutes = new Hono<AdminEnv>();

sessionRoutes.get("/acceso", (c) =>
  c.html(
    <LoginPage sent={c.req.query("ok") === "1"} suspended={c.req.query("suspendida") === "1"} />,
  ),
);

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
  const hit = await db.select().from(s.bands).where(eq(s.bands.contactEmail, email)).limit(1);
  const band = hit[0];

  // Send only when it matches, but answer identically either way — otherwise
  // this page tells anyone which addresses run a band. A banned band gets the
  // reason instead of a link, by mail, so the page still says nothing.
  if (band?.bannedAt) {
    c.executionCtx.waitUntil(sendSuspendedNotice(c.env, band));
  } else if (band) {
    const token = await sign(sessionSecret(c.env), bandLoginPayload(band.id), LOGIN_TTL);
    const url = `${c.env.APP_ORIGIN}/admin/entrar?t=${encodeURIComponent(token)}`;
    const mail = { bandName: band.name, url, minutes: Math.round(LOGIN_TTL / 60) };

    c.executionCtx.waitUntil(
      makeTransport(c.env)
        .send({
          to: email,
          subject: LOGIN_EMAIL_SUBJECT,
          html: loginEmailHtml(mail),
          text: loginEmailText(mail),
        })
        .then((result) => {
          if (!result.ok) console.error(`[admin] magic link failed for ${email}: ${result.error}`);
        }),
    );
  }
  return c.redirect("/admin/acceso?ok=1", 303);
});

const EXPIRED_LINK = "Ese enlace ya venció. Pedí uno nuevo.";
const SPENT_LINK = "Ese enlace ya se usó. Pedí uno nuevo si querés entrar otra vez.";

/**
 * A sign-in link opens a page with one button rather than the panel itself:
 * mail filters open links to scan them, and the link is spent on the tap, not
 * on the opening. Says so up front when the link is already spent.
 */
sessionRoutes.get("/entrar", async (c) => {
  const token = c.req.query("t");
  if (!token) return c.redirect("/admin/acceso", 302);

  const payload = await verify(sessionSecret(c.env), token);
  const bandId = bandFromLoginLink(payload);
  const link = linkToSpend(payload);
  if (!bandId || !link) return c.html(<LoginPage error={EXPIRED_LINK} />, 400);

  const db = drizzle(c.env.DB, { schema: s });
  const band = await findBand(db, bandId);
  if (!band) return c.html(<LoginPage error={EXPIRED_LINK} />, 400);
  // A link sent before the ban must not open a session after it.
  if (band.bannedAt) return c.html(<LoginPage suspended />, 403);
  if (await isSignInLinkSpent(db, link.linkId)) {
    return c.html(<LoginPage error={SPENT_LINK} />, 400);
  }
  return c.html(<SignInConfirmPage bandName={band.name} token={token} />);
});

/** Spends the link and opens the session. A second tap, or a second device, is refused. */
sessionRoutes.post("/entrar", async (c) => {
  const token = String((await c.req.parseBody())["t"] ?? "");
  const payload = token ? await verify(sessionSecret(c.env), token) : null;
  const bandId = bandFromLoginLink(payload);
  const link = linkToSpend(payload);
  if (!bandId || !link) return c.html(<LoginPage error={EXPIRED_LINK} />, 400);

  const db = drizzle(c.env.DB, { schema: s });
  const band = await findBand(db, bandId);
  if (!band) return c.html(<LoginPage error={EXPIRED_LINK} />, 400);
  if (band.bannedAt) return c.html(<LoginPage suspended />, 403);
  if (!(await spendSignInLink(db, link, nowIso()))) {
    return c.html(<LoginPage error={SPENT_LINK} />, 400);
  }

  const session = await sign(sessionSecret(c.env), bandSessionPayload(bandId), SESSION_TTL);
  c.header("Set-Cookie", sessionCookie(session, isHttps(c.env.APP_ORIGIN)));
  return c.redirect("/admin", 303);
});

sessionRoutes.get("/salir", (c) => {
  c.header("Set-Cookie", clearCookie(isHttps(c.env.APP_ORIGIN)));
  return c.redirect("/admin/acceso", 302);
});
