import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import { readFlags } from "../../db/queries/flags";
import * as s from "../../db/schema";
import { BandGuidePage } from "../../views/guide/band-guide";
import type { PublicEnv } from "./context";

export const guideRoutes = new Hono<PublicEnv>();

/**
 * The guide for bands: public, so it can be sent as a link to a band that has
 * not signed up yet. It reads the billing switch for the same reason the terms
 * do — what it says about paying has to match what the product charges today.
 */
guideRoutes.get("/guia", async (c) => {
  const flags = await readFlags(drizzle(c.env.DB, { schema: s }));
  return c.html(<BandGuidePage origin={c.env.APP_ORIGIN} billingEnabled={flags.billing} />);
});
