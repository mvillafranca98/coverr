import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import { listBandsByEmail } from "../../db/queries/bands";
import * as s from "../../db/schema";
import { mailBandCreateLink, mailBandSignInLink } from "../../jobs/mail-band-links";
import { sendSuspendedNotice } from "../../jobs/notify-suspended";
import { decideNewBand } from "../../lib/band-identity";
import { normalizeEmail } from "../../lib/core";
import { TOO_MANY_REQUESTS, withinMailLimit } from "../../lib/rate-limit";
import { TEXT_LIMITS } from "../../lib/text-limits";
import { SignupPage, SignupSentPage } from "../../views/signup";
import type { PublicEnv } from "./context";

export const signupRoutes = new Hono<PublicEnv>();

/**
 * Creating a band is the one flow a new user hits before they have anything,
 * so it asks for two fields and nothing else.
 *
 * Nothing is written here. The page mails a link and the band is created
 * only when that link is opened (routes/admin/create-band.tsx), so nobody can
 * start bands under an address they cannot read. What the mail says depends on
 * the bands the address already runs (lib/band-identity.ts): a link to create
 * this one, a sign-in link when a band of that name is already theirs, or the
 * suspension notice when one of theirs is suspended — a suspension follows the
 * person. The page answers the same in every case, so it cannot be used to
 * discover which addresses run a band.
 */
signupRoutes.get("/registro", (c) => c.html(<SignupPage />));

signupRoutes.post("/registro", async (c) => {
  const db = drizzle(c.env.DB, { schema: s });
  const body = await c.req.parseBody();
  const name = String(body["name"] ?? "")
    .trim()
    .slice(0, TEXT_LIMITS.name);
  const email = normalizeEmail(String(body["email"] ?? ""));

  if (!name) return c.html(<SignupPage error="Falta el nombre de la banda." email={email} />, 400);
  // Checked before the address is looked up, so a long one is refused the
  // same way whether or not a band already has it.
  if (email.length > TEXT_LIMITS.email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return c.html(<SignupPage error="Revisá el correo." name={name} />, 400);
  }
  if (!(await withinMailLimit(c.env.EMAIL_LIMIT, c, email))) {
    return c.html(<SignupPage error={TOO_MANY_REQUESTS} name={name} email={email} />, 429);
  }
  if (!c.env.SESSION_SECRET) return c.text("SESSION_SECRET no está configurado.", 500);

  const decision = decideNewBand(await listBandsByEmail(db, email), name);
  const mailing =
    decision.kind === "suspended"
      ? sendSuspendedNotice(c.env, { ...decision.band, contactEmail: email })
      : decision.kind === "existing"
        ? mailBandSignInLink(c.env, email, decision.band.name)
        : mailBandCreateLink(c.env, email, name);
  c.executionCtx.waitUntil(mailing);

  return c.html(<SignupSentPage email={email} />);
});
