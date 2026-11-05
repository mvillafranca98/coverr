import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import { createBand, findBand, listBandsByEmail } from "../../db/queries/bands";
import * as s from "../../db/schema";
import { decideNewBand } from "../../lib/band-identity";
import { nowIso } from "../../lib/core";
import { TEXT_LIMITS, tooLong } from "../../lib/text-limits";
import { BandsPage } from "../../views/admin/bands";
import type { AdminContext, AdminEnv } from "./context";
import { openSession } from "./session";

export const bandsRoutes = new Hono<AdminEnv>();

const SUSPENDED =
  "Una de tus bandas está suspendida, así que por ahora no podés crear bandas nuevas.";

async function renderBands(c: AdminContext, error?: string) {
  const db = drizzle(c.env.DB, { schema: s });
  const band = await findBand(db, c.get("bandId"));
  if (!band) return c.redirect("/admin/salir", 302);
  const email = c.get("signedInEmail");
  return c.html(
    <BandsPage
      bandName={band.name}
      currentBandId={band.id}
      email={email}
      bands={email ? await listBandsByEmail(db, email) : []}
      error={error}
    />,
  );
}

bandsRoutes.get("/bandas", (c) => renderBands(c));

/**
 * Moves the session to another of the person's bands. The band id comes from
 * the form, so it is checked against the address the session proved: a band
 * under any other address, or a suspended one, is not found.
 */
bandsRoutes.post("/bandas/cambiar", async (c) => {
  const email = c.get("signedInEmail");
  const bandId = String((await c.req.parseBody())["band_id"] ?? "");
  const target = email ? await findBand(drizzle(c.env.DB, { schema: s }), bandId) : null;
  if (!email || !target || target.contactEmail !== email || target.bannedAt) return c.notFound();
  return openSession(c, target.id, email, "/admin");
});

/**
 * Starts another band under the signed-in address. No mailed link is needed:
 * the session already proved the address. The same rules as /registro apply —
 * a suspension follows the person, and a name the person already uses opens
 * that band rather than a twin.
 */
bandsRoutes.post("/bandas/nueva", async (c) => {
  const email = c.get("signedInEmail");
  if (!email) return c.redirect("/admin/bandas", 303);
  const name = String((await c.req.parseBody())["name"] ?? "").trim();
  if (!name) return renderBands(c, "Falta el nombre de la banda.");
  const nameError = tooLong(name, TEXT_LIMITS.name, "El nombre de la banda");
  if (nameError) return renderBands(c, nameError);

  const db = drizzle(c.env.DB, { schema: s });
  const decision = decideNewBand(await listBandsByEmail(db, email), name);
  if (decision.kind === "suspended") return renderBands(c, SUSPENDED);
  const bandId =
    decision.kind === "existing"
      ? decision.band.id
      : await createBand(db, { name, email, at: nowIso() });
  return openSession(c, bandId, email, "/admin");
});
