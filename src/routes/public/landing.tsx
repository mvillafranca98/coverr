import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import { readFlags } from "../../db/queries/flags";
import * as s from "../../db/schema";
import { pickDemoShow } from "../../views/demo-shows";
import { LandingPage } from "../../views/landing/page";
import type { PublicEnv } from "./context";

export const landingRoutes = new Hono<PublicEnv>();

/**
 * The front page. Belongs to no band and reads one thing: whether billing is
 * on, so the price list can say when nobody is being charged. Like the terms,
 * the published page has to agree with the switch, not with a sentence
 * somebody has to remember to edit.
 *
 * Picks the invented show the page demonstrates with, once, so the hero ticket
 * and the screenshots below it all show the same one.
 */
landingRoutes.get("/", async (c) => {
  const db = drizzle(c.env.DB, { schema: s });
  const flags = await readFlags(db);
  return c.html(
    <LandingPage origin={c.env.APP_ORIGIN} billingEnabled={flags.billing} show={pickDemoShow()} />,
  );
});
