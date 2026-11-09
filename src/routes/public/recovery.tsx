import { Hono } from "hono";
import { sendTicketRecovery } from "../../jobs/send-recovery";
import { normalizeEmail } from "../../lib/core";
import { TOO_MANY_REQUESTS, withinMailLimit } from "../../lib/rate-limit";
import { RecoverPage } from "../../views/recover";
import type { PublicEnv } from "./context";

export const recoveryRoutes = new Hono<PublicEnv>();

recoveryRoutes.get("/recuperar", (c) => c.html(<RecoverPage sent={c.req.query("ok") === "1"} />));

/**
 * Mails the tickets on an address, as one email. Answers the same way whether
 * or not the address bought anything, so the page cannot be used to test who
 * did; the limit is spent the same way too.
 */
recoveryRoutes.post("/recuperar", async (c) => {
  const body = await c.req.parseBody();
  const email = typeof body["email"] === "string" ? normalizeEmail(body["email"]) : "";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return c.html(<RecoverPage error="Revisá el correo que escribiste." />, 400);
  }

  if (!(await withinMailLimit(c.env.EMAIL_LIMIT, c, email))) {
    return c.html(<RecoverPage error={TOO_MANY_REQUESTS} />, 429);
  }

  c.executionCtx.waitUntil(sendTicketRecovery(c.env, email));
  return c.redirect("/recuperar?ok=1", 303);
});
