import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { and, eq } from "drizzle-orm";
import * as s from "../../db/schema";
import { RecoverPage } from "../../views/recover";
import { sendTickets } from "../../lib/tickets";
import { normalizeEmail } from "../../lib/core";
import type { PublicEnv } from "./context";

export const recoveryRoutes = new Hono<PublicEnv>();

recoveryRoutes.get("/recuperar", (c) => c.html(<RecoverPage sent={c.req.query("ok") === "1"} />));

/**
 * Resends the tickets on an address. Answers the same way whether or not the
 * address bought anything, so the page cannot be used to test who did.
 */
recoveryRoutes.post("/recuperar", async (c) => {
  const body = await c.req.parseBody();
  const email = typeof body["email"] === "string" ? normalizeEmail(body["email"]) : "";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return c.html(<RecoverPage error="Revisá el correo que escribiste." />, 400);
  }

  const db = drizzle(c.env.DB, { schema: s });
  const found = await db
    .select({ id: s.orders.id })
    .from(s.orders)
    .innerJoin(s.events, eq(s.orders.eventId, s.events.id))
    .where(and(eq(s.orders.payerEmail, email), eq(s.orders.status, "confirmed")));

  // Resend every live order on that address, then answer identically whether or
  // not anything matched.
  c.executionCtx.waitUntil(
    (async () => {
      for (const order of found) await sendTickets(c.env, order.id);
    })(),
  );

  return c.redirect("/recuperar?ok=1", 303);
});
