import { drizzle } from "drizzle-orm/d1";
import { Hono, type MiddlewareHandler } from "hono";
import { isSignInLinkSpent, spendSignInLink } from "../../db/queries/sign-in-links";
import * as s from "../../db/schema";
import {
  clearOperatorCookie,
  LOGIN_TTL,
  OPERATOR_COOKIE,
  OPERATOR_SESSION_TTL,
  operatorCookie,
  readCookie,
  sessionSecret,
  sign,
  verify,
} from "../../lib/auth";
import { normalizeEmail, nowIso } from "../../lib/core";
import { makeTransport } from "../../lib/email";
import { isOperatorEmail, operatorFromToken, operatorTokenPayload } from "../../lib/operator";
import { TOO_MANY_REQUESTS, withinMailLimit } from "../../lib/rate-limit";
import { linkToSpend } from "../../lib/sign-in";
import { LOGIN_EMAIL_SUBJECT, loginEmailHtml, loginEmailText } from "../../views/email";
import { OperatorLoginPage, OperatorSignInConfirmPage } from "../../views/operator/login";
import type { OperatorEnv } from "./context";

const isHttps = (origin: string) => origin.startsWith("https://");

/** The only operator paths reachable without a session — everything sign-in needs. */
const PUBLIC_PATHS = new Set(["/operador/acceso", "/operador/entrar", "/operador/salir"]);

/**
 * Gate for everything under /operador, registered before any other router.
 *
 * Checked on the server on every request: the cookie must be an operator
 * session (a band's cookie is a different name and shape, and never passes),
 * and its address must still be on the operator list — so taking someone off
 * the list ends their access on their next click.
 */
export const requireOperator: MiddlewareHandler<OperatorEnv> = async (c, next) => {
  const path = new URL(c.req.url).pathname;
  if (PUBLIC_PATHS.has(path)) return next();

  const raw = readCookie(c.req.header("Cookie"), OPERATOR_COOKIE);
  const payload = raw ? await verify(sessionSecret(c.env), raw) : null;
  const email = operatorFromToken(payload, "operator-session");
  if (!email || !isOperatorEmail(email, c.env.OPERATOR_EMAILS)) {
    return c.redirect("/operador/acceso", 302);
  }

  c.set("operatorEmail", email);
  return next();
};

export const operatorSessionRoutes = new Hono<OperatorEnv>();

operatorSessionRoutes.get("/acceso", (c) =>
  c.html(<OperatorLoginPage sent={c.req.query("ok") === "1"} />),
);

operatorSessionRoutes.post("/acceso", async (c) => {
  const body = await c.req.parseBody();
  const email = typeof body["email"] === "string" ? normalizeEmail(body["email"]) : "";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return c.html(<OperatorLoginPage error="Revisá el correo que escribiste." />, 400);
  }
  if (!(await withinMailLimit(c.env.EMAIL_LIMIT, c, email))) {
    return c.html(<OperatorLoginPage error={TOO_MANY_REQUESTS} />, 429);
  }

  // Mail only an operator, but answer the same either way.
  if (isOperatorEmail(email, c.env.OPERATOR_EMAILS)) {
    const token = await sign(
      sessionSecret(c.env),
      operatorTokenPayload(email, "operator-login"),
      LOGIN_TTL,
    );
    const url = `${c.env.APP_ORIGIN}/operador/entrar?t=${encodeURIComponent(token)}`;
    const mail = { bandName: "operación de Coverr", url, minutes: Math.round(LOGIN_TTL / 60) };
    c.executionCtx.waitUntil(
      makeTransport(c.env)
        .send({
          to: email,
          subject: LOGIN_EMAIL_SUBJECT,
          html: loginEmailHtml(mail),
          text: loginEmailText(mail),
        })
        .then((result) => {
          if (!result.ok) console.error(`[operator] sign-in link failed: ${result.error}`);
        }),
    );
  }
  return c.redirect("/operador/acceso?ok=1", 303);
});

const EXPIRED_LINK = "Ese enlace ya venció. Pedí uno nuevo.";
const SPENT_LINK = "Ese enlace ya se usó. Pedí uno nuevo si querés entrar otra vez.";

/**
 * The operator a sign-in link opens, and the id to spend it by, or null.
 * Re-checks the list: an address taken off it while its link was in flight
 * does not get in.
 */
async function readOperatorLink(c: { env: OperatorEnv["Bindings"] }, token: string | undefined) {
  const payload = token ? await verify(sessionSecret(c.env), token) : null;
  const email = operatorFromToken(payload, "operator-login");
  const link = linkToSpend(payload);
  if (!email || !link || !isOperatorEmail(email, c.env.OPERATOR_EMAILS)) return null;
  return { email, link };
}

/** Lands on a button rather than the panel: a mail filter opening the link must not spend it. */
operatorSessionRoutes.get("/entrar", async (c) => {
  const token = c.req.query("t");
  const signIn = await readOperatorLink(c, token);
  if (!token || !signIn) return c.html(<OperatorLoginPage error={EXPIRED_LINK} />, 400);
  if (await isSignInLinkSpent(drizzle(c.env.DB, { schema: s }), signIn.link.linkId)) {
    return c.html(<OperatorLoginPage error={SPENT_LINK} />, 400);
  }
  return c.html(<OperatorSignInConfirmPage token={token} />);
});

/** Spends the link and opens the session; a second tap is refused. */
operatorSessionRoutes.post("/entrar", async (c) => {
  const token = String((await c.req.parseBody())["t"] ?? "");
  const signIn = await readOperatorLink(c, token);
  if (!signIn) return c.html(<OperatorLoginPage error={EXPIRED_LINK} />, 400);
  const db = drizzle(c.env.DB, { schema: s });
  if (!(await spendSignInLink(db, signIn.link, nowIso()))) {
    return c.html(<OperatorLoginPage error={SPENT_LINK} />, 400);
  }
  const email = signIn.email;

  const session = await sign(
    sessionSecret(c.env),
    operatorTokenPayload(email, "operator-session"),
    OPERATOR_SESSION_TTL,
  );
  c.header("Set-Cookie", operatorCookie(session, isHttps(c.env.APP_ORIGIN)));
  return c.redirect("/operador", 303);
});

/** A POST from the Salir button only, like the band panel's: no link elsewhere can sign out. */
operatorSessionRoutes.post("/salir", (c) => {
  c.header("Set-Cookie", clearOperatorCookie(isHttps(c.env.APP_ORIGIN)));
  return c.redirect("/operador/acceso", 302);
});
operatorSessionRoutes.get("/salir", (c) => c.redirect("/operador", 302));
