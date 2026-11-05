import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import { createBand, listBandsByEmail } from "../../db/queries/bands";
import { isSignInLinkSpent, spendSignInLink } from "../../db/queries/sign-in-links";
import * as s from "../../db/schema";
import { sessionSecret, verify } from "../../lib/auth";
import { decideNewBand } from "../../lib/band-identity";
import { nowIso } from "../../lib/core";
import { bandToCreate, linkToSpend } from "../../lib/sign-in";
import { CreateBandConfirmPage, LoginPage } from "../../views/admin/login";
import type { AdminContext, AdminEnv } from "./context";
import { EXPIRED_LINK, openSession, SPENT_LINK } from "./session";

export const createBandRoutes = new Hono<AdminEnv>();

/** What a creation link asks for, and what the address's bands make of it now. */
async function readCreateLink(c: AdminContext, token: string) {
  const payload = await verify(sessionSecret(c.env), token);
  const request = bandToCreate(payload);
  const link = linkToSpend(payload);
  if (!request || !link) return null;
  const db = drizzle(c.env.DB, { schema: s });
  const decision = decideNewBand(await listBandsByEmail(db, request.email), request.name);
  return { ...request, link, db, decision };
}

/**
 * Where a creation link from /registro lands: one button, because a mail
 * filter opening the link must neither spend it nor create a band.
 */
createBandRoutes.get("/crear", async (c) => {
  const token = c.req.query("t");
  const create = token ? await readCreateLink(c, token) : null;
  if (!token || !create) return c.html(<LoginPage error={EXPIRED_LINK} />, 400);
  if (create.decision.kind === "suspended") return c.html(<LoginPage suspended />, 403);
  if (await isSignInLinkSpent(create.db, create.link.linkId)) {
    return c.html(<LoginPage error={SPENT_LINK} />, 400);
  }
  return c.html(<CreateBandConfirmPage bandName={create.name} token={token} />);
});

/**
 * Spends the link and creates the band — or, when a band of that name is
 * already the address's, opens it instead of making a twin. Decided again here,
 * not trusted from the page: a suspension can land between the two.
 */
createBandRoutes.post("/crear", async (c) => {
  const token = String((await c.req.parseBody())["t"] ?? "");
  const create = token ? await readCreateLink(c, token) : null;
  if (!create) return c.html(<LoginPage error={EXPIRED_LINK} />, 400);
  if (create.decision.kind === "suspended") return c.html(<LoginPage suspended />, 403);
  const at = nowIso();
  if (!(await spendSignInLink(create.db, create.link, at))) {
    return c.html(<LoginPage error={SPENT_LINK} />, 400);
  }

  const bandId =
    create.decision.kind === "existing"
      ? create.decision.band.id
      : await createBand(create.db, { name: create.name, email: create.email, at });
  return openSession(c, bandId, create.email, "/admin");
});
