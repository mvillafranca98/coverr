import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import { findBandByEmail, uniqueBandSlug } from "../../db/queries/bands";
import * as s from "../../db/schema";
import { LOGIN_TTL, sign } from "../../lib/auth";
import { newId, normalizeEmail, nowIso } from "../../lib/core";
import { makeTransport } from "../../lib/email";
import { clientIp, TOO_MANY_REQUESTS, withinLimit } from "../../lib/rate-limit";
import { signupEmailHtml, signupEmailSubject, signupEmailText } from "../../views/email";
import { SignupPage, SignupSentPage } from "../../views/signup";
import type { PublicEnv } from "./context";

export const signupRoutes = new Hono<PublicEnv>();

/**
 * Creating a band is the one flow a new user hits before they have anything,
 * so it asks for two fields and nothing else.
 *
 * An email that already belongs to a band does not error and does not say so —
 * it just sends that band a login link. Same response either way, so the page
 * cannot be used to discover which addresses run a band.
 */
signupRoutes.get("/registro", (c) => c.html(<SignupPage />));

signupRoutes.post("/registro", async (c) => {
  if (!(await withinLimit(c.env.EMAIL_LIMIT, `mail:${clientIp(c)}`))) {
    return c.html(<SignupPage error={TOO_MANY_REQUESTS} />, 429);
  }

  const db = drizzle(c.env.DB, { schema: s });
  const body = await c.req.parseBody();
  const name = String(body["name"] ?? "")
    .trim()
    .slice(0, 80);
  const email = normalizeEmail(String(body["email"] ?? ""));

  if (!name) return c.html(<SignupPage error="Falta el nombre de la banda." email={email} />, 400);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return c.html(<SignupPage error="Revisá el correo." name={name} />, 400);
  }
  if (!c.env.SESSION_SECRET) return c.text("SESSION_SECRET no está configurado.", 500);

  const existing = await findBandByEmail(db, email);

  let bandId: string;
  let bandName: string;
  if (existing) {
    bandId = existing.id;
    bandName = existing.name;
  } else {
    bandId = newId("bnd");
    bandName = name;
    await db.insert(s.bands).values({
      id: bandId,
      name,
      slug: await uniqueBandSlug(db, name),
      contactEmail: email,
      createdAt: nowIso(),
    });
  }

  const token = await sign(c.env.SESSION_SECRET, { b: bandId }, LOGIN_TTL);
  const mail = { bandName, url: `${c.env.APP_ORIGIN}/admin/entrar?t=${encodeURIComponent(token)}` };
  c.executionCtx.waitUntil(
    makeTransport(c.env)
      .send({
        to: email,
        subject: signupEmailSubject(mail),
        html: signupEmailHtml(mail),
        text: signupEmailText(mail),
      })
      .then((result) => {
        if (!result.ok) console.error(`[signup] link failed for ${email}: ${result.error}`);
      }),
  );

  return c.html(<SignupSentPage email={email} />);
});
