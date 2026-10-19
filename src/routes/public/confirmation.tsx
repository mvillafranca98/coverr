import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import * as s from "../../db/schema";
import { ConfirmPage } from "../../views/confirm/page";
import { findOrderWithEventAndBand } from "../../db/queries/orders";
import type { PublicEnv } from "./context";

export const confirmationRoutes = new Hono<PublicEnv>();

/**
 * The page the buyer lands on after paying, and the link in their email. It is
 * where the QR codes live, so it stays reachable for anyone holding the order
 * id — a voided order is the one exception.
 */
confirmationRoutes.get("/boletos/:orderId", async (c) => {
  const db = drizzle(c.env.DB, { schema: s });
  const found = await findOrderWithEventAndBand(db, c.req.param("orderId"));
  if (!found || found.order.status === "void") return c.notFound();

  const attendees = await db
    .select()
    .from(s.attendees)
    .where(eq(s.attendees.orderId, found.order.id));

  return c.html(
    <ConfirmPage
      band={found.band}
      event={found.event}
      order={found.order}
      attendees={attendees}
    />,
  );
});
