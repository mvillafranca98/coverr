import { Hono, type MiddlewareHandler } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import * as s from "../../db/schema";
import { LoginPage } from "../../views/admin/login";
import { loginEmailHtml, loginEmailText, LOGIN_EMAIL_SUBJECT } from "../../views/email";
import { makeTransport } from "../../lib/email";
import {
  sign,
  verify,
  SESSION_COOKIE,
  LOGIN_TTL,
  SESSION_TTL,
  sessionCookie,
  clearCookie,
  readCookie,
} from "../../lib/auth";
import { normalizeEmail } from "../../lib/core";
import type { AdminEnv, Bindings } from "./context";
import { withinLimit, clientIp, TOO_MANY_REQUESTS } from "../../lib/rate-limit";

function secretOf(env: Bindings): string {
  // Without a configured secret the admin is not safe to serve at all, so fail
  // loudly rather than silently signing sessions with a guessable constant.
  const secret = env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not configured");
  return secret;
}

const isHttps = (origin: string) => origin.startsWith("https://");

/** The only admin paths reachable without a session — everything sign-in needs. */
const PUBLIC_PATHS = new Set([
  "/admin/acceso",
  "/admin/login",
  "/admin/entrar",
  "/admin/salir",
]);

/**
 * Gate for everything under /admin. Registered on the parent router before any
 * feature router, so `c.get("bandId")` is always populated downstream.
 */
export const requireSession: MiddlewareHandler<AdminEnv> = async (c, next) => {
  const path = new URL(c.req.url).pathname;
  if (PUBLIC_PATHS.has(path)) return next();

  const raw = readCookie(c.req.header("Cookie"), SESSION_COOKIE);
  if (!raw) return c.redirect("/admin/acceso", 302);
  const payload = await verify<{ b: string }>(secretOf(c.env), raw);
  if (!payload?.b) return c.redirect("/admin/acceso", 302);

  c.set("bandId", payload.b);
  return next();
};

export const sessionRoutes = new Hono<AdminEnv>();

sessionRoutes.get("/acceso", (c) => c.html(<LoginPage sent={c.req.query("ok") === "1"} />));

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
  // this page tells anyone which addresses run a band.
  if (band) {
    const token = await sign(secretOf(c.env), { b: band.id }, LOGIN_TTL);
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

sessionRoutes.get("/entrar", async (c) => {
  const token = c.req.query("t");
  if (!token) return c.redirect("/admin/acceso", 302);

  const payload = await verify<{ b: string }>(secretOf(c.env), token);
  if (!payload?.b) {
    return c.html(<LoginPage error="Ese enlace ya venció. Pedí uno nuevo." />, 400);
  }

  const session = await sign(secretOf(c.env), { b: payload.b }, SESSION_TTL);
  c.header("Set-Cookie", sessionCookie(session, isHttps(c.env.APP_ORIGIN)));
  return c.redirect("/admin", 302);
});

sessionRoutes.get("/salir", (c) => {
  c.header("Set-Cookie", clearCookie(isHttps(c.env.APP_ORIGIN)));
  return c.redirect("/admin/acceso", 302);
});
