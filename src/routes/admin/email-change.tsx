import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import { findBand, listBandsByEmail, moveBandToEmail } from "../../db/queries/bands";
import { isSignInLinkSpent, spendSignInLink } from "../../db/queries/sign-in-links";
import * as s from "../../db/schema";
import { sessionSecret, verify } from "../../lib/auth";
import { addressTakesBand } from "../../lib/band-identity";
import { nowIso } from "../../lib/core";
import { emailChangeFromLink, linkToSpend } from "../../lib/sign-in";
import { EmailChangeConfirmPage, LoginPage } from "../../views/admin/login";
import { CONTACT_EMAIL } from "../../views/legal/constants";
import type { AdminContext, AdminEnv } from "./context";
import { EXPIRED_LINK, openSession, SPENT_LINK } from "./session";

export const emailChangeRoutes = new Hono<AdminEnv>();

const STALE_LINK =
  "Este enlace ya no sirve: el correo de la banda cambió después de pedirlo. Pedí otro desde Ajustes.";
const ADDRESS_REFUSED = `Ese correo no se puede usar. Escribinos a ${CONTACT_EMAIL}.`;

/** A verified email-change link, its id to spend, and the band it moves. */
async function readChangeLink(c: AdminContext, token: string) {
  const payload = await verify(sessionSecret(c.env), token);
  const change = emailChangeFromLink(payload);
  const link = linkToSpend(payload);
  if (!change || !link) return null;
  const db = drizzle(c.env.DB, { schema: s });
  return { change, link, db, band: await findBand(db, change.bandId) };
}

type ChangeLink = NonNullable<Awaited<ReturnType<typeof readChangeLink>>>;

/**
 * Why the move cannot happen now, as the page to show, or null when it can.
 * Asked again on the POST, not trusted from the GET: the band may move, or the
 * address gain a suspended band, between the two.
 */
async function refusal(c: AdminContext, { change, db, band }: ChangeLink) {
  if (!band) return c.html(<LoginPage error={EXPIRED_LINK} />, 400);
  if (band.bannedAt) return c.html(<LoginPage suspended />, 403);
  if (band.contactEmail !== change.from) return c.html(<LoginPage error={STALE_LINK} />, 400);
  if (!addressTakesBand(await listBandsByEmail(db, change.to), band.id)) {
    return c.html(<LoginPage error={ADDRESS_REFUSED} />, 403);
  }
  return null;
}

/**
 * Where an email-change link lands: one button, because a mail filter opening
 * the link must neither spend it nor move the band. Opened by whoever reads the
 * new address, signed in or not.
 */
emailChangeRoutes.get("/correo", async (c) => {
  const token = c.req.query("t") ?? "";
  const read = token ? await readChangeLink(c, token) : null;
  if (!read) return c.html(<LoginPage error={EXPIRED_LINK} />, 400);
  if (await isSignInLinkSpent(read.db, read.link.linkId)) {
    return c.html(<LoginPage error={SPENT_LINK} />, 400);
  }
  const refused = await refusal(c, read);
  if (refused) return refused;
  return c.html(
    <EmailChangeConfirmPage
      bandName={read.band?.name ?? ""}
      email={read.change.to}
      token={token}
    />,
  );
});

/**
 * Spends the link and moves the band onto the address that just proved itself,
 * then signs that address in: it is now the band's way in.
 */
emailChangeRoutes.post("/correo", async (c) => {
  const token = String((await c.req.parseBody())["t"] ?? "");
  const read = token ? await readChangeLink(c, token) : null;
  if (!read) return c.html(<LoginPage error={EXPIRED_LINK} />, 400);
  const refused = await refusal(c, read);
  if (refused) return refused;
  if (!(await spendSignInLink(read.db, read.link, nowIso()))) {
    return c.html(<LoginPage error={SPENT_LINK} />, 400);
  }
  if (!(await moveBandToEmail(read.db, read.change))) {
    return c.html(<LoginPage error={STALE_LINK} />, 400);
  }
  return openSession(c, read.change.bandId, read.change.to, "/admin/banda?correo=1");
});
