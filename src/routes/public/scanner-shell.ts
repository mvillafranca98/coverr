import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import { findEventByStaffToken } from "../../db/queries/events";
import * as s from "../../db/schema";
import { doorAccess } from "../../lib/door-window";
import { scannerClosedHtml, scannerShellHtml } from "../../views/scanner";
import type { PublicEnv } from "./context";

export const scannerShellRoutes = new Hono<PublicEnv>();

/**
 * Scanner shell. Access is a per-event staff token in the URL rather than an
 * account: staff arrive with no login, often on a borrowed phone, at a venue
 * where a magic-link round-trip through an inbox is exactly what you cannot do.
 */
scannerShellRoutes.get("/scan/:token", async (c) => {
  const token = c.req.param("token");
  const db = drizzle(c.env.DB, { schema: s });
  const found = await findEventByStaffToken(db, token);
  if (!found) return c.notFound();
  // Still served while late syncs are taken: it is the page that sends them.
  if (doorAccess(found.event.startsAt, new Date()) === "closed") {
    return c.html(
      scannerClosedHtml({ eventName: found.event.name, bandName: found.band.name, token }),
      410,
    );
  }

  return c.html(
    scannerShellHtml({
      eventName: found.event.name,
      venue: found.event.venue,
      bandName: found.band.name,
      token,
    }),
  );
});
