import { eq } from "drizzle-orm";
import { type DrizzleD1Database, drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import * as s from "../../db/schema";
import { qrPng, qrSvg } from "../../lib/qr";
import type { PublicEnv } from "./context";

export const qrFileRoutes = new Hono<PublicEnv>();

/** An unknown token is a 404: these URLs must not confirm what does not exist. */
async function ticketExists(db: DrizzleD1Database<typeof s>, token: string): Promise<boolean> {
  const hit = await db
    .select({ id: s.attendees.id })
    .from(s.attendees)
    .where(eq(s.attendees.qrToken, token))
    .limit(1);
  return hit.length > 0;
}

/** For the screen: sharp at any size and rendered on the fly. */
qrFileRoutes.get("/t/:token{.+\\.svg}", async (c) => {
  const token = c.req.param("token").replace(/\.svg$/, "");
  const db = drizzle(c.env.DB, { schema: s });
  if (!(await ticketExists(db, token))) return c.notFound();

  return c.body(qrSvg(token, { size: 640 }), 200, {
    "Content-Type": "image/svg+xml; charset=utf-8",
    "Cache-Control": "private, max-age=31536000, immutable",
  });
});

/** For email: Gmail refuses SVG and data: URIs, so the ticket mail links here. */
qrFileRoutes.get("/t/:token{.+\\.png}", async (c) => {
  const token = c.req.param("token").replace(/\.png$/, "");
  const db = drizzle(c.env.DB, { schema: s });
  if (!(await ticketExists(db, token))) return c.notFound();

  const png = await qrPng(token, 8);
  return c.body(png, 200, {
    "Content-Type": "image/png",
    "Cache-Control": "public, max-age=31536000, immutable",
  });
});
