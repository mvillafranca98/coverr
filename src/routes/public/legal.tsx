import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import { readFlags } from "../../db/queries/flags";
import * as s from "../../db/schema";
import { PrivacyPage } from "../../views/legal/privacy";
import { TermsPage } from "../../views/legal/terms";
import type { PublicEnv } from "./context";

export const legalRoutes = new Hono<PublicEnv>();

/**
 * The two legal documents. They belong to no band and are the only
 * buyer-surface pages meant to be found in a search result — a policy nobody
 * can reach is not published.
 *
 * The terms read one thing: whether billing is on. The published page has to
 * agree with what the product actually charges, and that is a switch now.
 */
legalRoutes.get("/privacidad", (c) => c.html(<PrivacyPage origin={c.env.APP_ORIGIN} />));
legalRoutes.get("/terminos", async (c) => {
  const db = drizzle(c.env.DB, { schema: s });
  const flags = await readFlags(db);
  return c.html(<TermsPage origin={c.env.APP_ORIGIN} billingEnabled={flags.billing} />);
});
