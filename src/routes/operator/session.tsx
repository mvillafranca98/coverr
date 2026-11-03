import { Hono, type MiddlewareHandler } from "hono";
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
import { normalizeEmail } from "../../lib/core";
import { makeTransport } from "../../lib/email";
import { isOperatorEmail, operatorFromToken, operatorTokenPayload } from "../../lib/operator";
import { clientIp, TOO_MANY_REQUESTS, withinLimit } from "../../lib/rate-limit";
import { LOGIN_EMAIL_SUBJECT, loginEmailHtml, loginEmailText } from "../../views/email";
import { OperatorLoginPage } from "../../views/operator/login";
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
  if (!(await withinLimit(c.env.EMAIL_LIMIT, `mail:${clientIp(c)}`))) {
    return c.html(<OperatorLoginPage error={TOO_MANY_REQUESTS} />, 429);
  }

  const body = await c.req.parseBody();
  const email = typeof body["email"] === "string" ? normalizeEmail(body["email"]) : "";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return c.html(<OperatorLoginPage error="Revisá el correo que escribiste." />, 400);
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

operatorSessionRoutes.get("/entrar", async (c) => {
  const token = c.req.query("t");
  const payload = token ? await verify(sessionSecret(c.env), token) : null;
  const email = operatorFromToken(payload, "operator-login");
  // Re-checked here as well: an address taken off the list while its link was
  // in flight does not get in.
  if (!email || !isOperatorEmail(email, c.env.OPERATOR_EMAILS)) {
    return c.html(<OperatorLoginPage error="Ese enlace ya venció. Pedí uno nuevo." />, 400);
  }

  const session = await sign(
    sessionSecret(c.env),
    operatorTokenPayload(email, "operator-session"),
    OPERATOR_SESSION_TTL,
  );
  c.header("Set-Cookie", operatorCookie(session, isHttps(c.env.APP_ORIGIN)));
  return c.redirect("/operador", 302);
});

operatorSessionRoutes.get("/salir", (c) => {
  c.header("Set-Cookie", clearOperatorCookie(isHttps(c.env.APP_ORIGIN)));
  return c.redirect("/operador/acceso", 302);
});
