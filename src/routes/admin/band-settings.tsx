import { and, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import { findBand, findBandEventById, findBandMember } from "../../db/queries/bands";
import * as s from "../../db/schema";
import { lpsToCentavos, newId, normalizeEmail, nowIso } from "../../lib/core";
import { BandSettingsPage } from "../../views/setup/band-settings";
import type { AdminContext, AdminEnv } from "./context";

export const bandSettingsRoutes = new Hono<AdminEnv>();

const SAVED = "/admin/banda?saved=1";

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

async function renderBandSettings(c: AdminContext, opts: { error?: string; saved?: boolean } = {}) {
  const db = drizzle(c.env.DB, { schema: s });
  const bandId = c.get("bandId");
  const band = await findBand(db, bandId);
  if (!band) return c.redirect("/admin/salir", 302);

  const [accounts, members, events] = await Promise.all([
    db
      .select()
      .from(s.bankAccounts)
      .where(eq(s.bankAccounts.bandId, bandId))
      .orderBy(s.bankAccounts.sortOrder),
    db
      .select()
      .from(s.bandMembers)
      .where(eq(s.bandMembers.bandId, bandId))
      .orderBy(s.bandMembers.sortOrder),
    db.select().from(s.events).where(eq(s.events.bandId, bandId)).orderBy(desc(s.events.startsAt)),
  ]);

  const advanceRows = await db
    .select({ advance: s.advances, member: s.bandMembers })
    .from(s.advances)
    .innerJoin(
      s.bandMembers,
      // Band-constrained on the join as well as the filter: a row written
      // before this was enforced must not render a stranger's name either.
      and(eq(s.advances.memberId, s.bandMembers.id), eq(s.bandMembers.bandId, bandId)),
    )
    .where(eq(s.advances.bandId, bandId))
    .orderBy(desc(s.advances.date));
  const eventNameById = new Map(events.map((e) => [e.id, e.name]));

  return c.html(
    <BandSettingsPage
      band={band}
      accounts={accounts}
      members={members}
      events={events}
      advances={advanceRows.map((row) => ({
        id: row.advance.id,
        memberName: row.member.name,
        amount: row.advance.amount,
        date: row.advance.date,
        eventName: row.advance.eventId ? (eventNameById.get(row.advance.eventId) ?? null) : null,
      }))}
      error={opts.error}
      saved={opts.saved}
    />,
  );
}

bandSettingsRoutes.get("/banda", (c) =>
  renderBandSettings(c, { saved: c.req.query("saved") === "1" }),
);

bandSettingsRoutes.post("/banda", async (c) => {
  const db = drizzle(c.env.DB, { schema: s });
  const body = await c.req.parseBody();
  const name = String(body["name"] ?? "").trim();
  const contactEmail = normalizeEmail(String(body["contact_email"] ?? ""));

  if (!name) return renderBandSettings(c, { error: "Falta el nombre de la banda." });
  if (!EMAIL_PATTERN.test(contactEmail)) {
    return renderBandSettings(c, { error: "Revisá el correo." });
  }

  await db
    .update(s.bands)
    .set({ name, contactEmail })
    .where(eq(s.bands.id, c.get("bandId")));
  return c.redirect(SAVED, 303);
});

// ---------------------------------------------------------- bank accounts

bandSettingsRoutes.post("/banda/cuenta", async (c) => {
  const db = drizzle(c.env.DB, { schema: s });
  const bandId = c.get("bandId");
  const body = await c.req.parseBody();
  const accountNumber = String(body["account_number"] ?? "").replace(/\s/g, "");
  const holderName = String(body["holder_name"] ?? "").trim();
  const bank = String(body["bank"] ?? "BAC");

  if (!accountNumber || !holderName) {
    return renderBandSettings(c, { error: "Falta el número de cuenta o el titular." });
  }

  const existing = await db
    .select({ id: s.bankAccounts.id })
    .from(s.bankAccounts)
    .where(eq(s.bankAccounts.bandId, bandId));

  await db.insert(s.bankAccounts).values({
    id: newId("acc"),
    bandId,
    bank,
    accountNumber,
    holderName,
    // First account added becomes the one shown to buyers who pick "Otro".
    isDefault: existing.length === 0 ? 1 : 0,
    active: 1,
    sortOrder: existing.length,
  });
  return c.redirect(SAVED, 303);
});

bandSettingsRoutes.post("/banda/cuenta/borrar", async (c) => {
  const db = drizzle(c.env.DB, { schema: s });
  const bandId = c.get("bandId");
  const accountId = String((await c.req.parseBody())["id"] ?? "");

  await db
    .delete(s.bankAccounts)
    .where(and(eq(s.bankAccounts.id, accountId), eq(s.bankAccounts.bandId, bandId)));

  // Never leave the band without a default, or "Otro" has nothing to show.
  const remaining = await db
    .select()
    .from(s.bankAccounts)
    .where(eq(s.bankAccounts.bandId, bandId))
    .orderBy(s.bankAccounts.sortOrder);
  if (remaining.length > 0 && !remaining.some((a) => a.isDefault === 1)) {
    await db
      .update(s.bankAccounts)
      .set({ isDefault: 1 })
      .where(eq(s.bankAccounts.id, remaining[0]!.id));
  }
  return c.redirect(SAVED, 303);
});

// ----------------------------------------------------------------- members

bandSettingsRoutes.post("/banda/integrante", async (c) => {
  const db = drizzle(c.env.DB, { schema: s });
  const bandId = c.get("bandId");
  const body = await c.req.parseBody();
  const memberId = String(body["id"] ?? "");
  const name = String(body["name"] ?? "").trim();
  const splitPct = Number(body["split_pct"]);

  if (!name || !Number.isFinite(splitPct) || splitPct < 0 || splitPct > 100) {
    return renderBandSettings(c, { error: "Revisá el nombre y el porcentaje (0 a 100)." });
  }

  if (memberId) {
    await db
      .update(s.bandMembers)
      .set({ name, splitPct })
      .where(and(eq(s.bandMembers.id, memberId), eq(s.bandMembers.bandId, bandId)));
  } else {
    const existing = await db
      .select({ id: s.bandMembers.id })
      .from(s.bandMembers)
      .where(eq(s.bandMembers.bandId, bandId));
    await db.insert(s.bandMembers).values({
      id: newId("mem"),
      bandId,
      name,
      splitPct,
      isCore: 1,
      sortOrder: existing.length,
    });
  }
  return c.redirect(SAVED, 303);
});

bandSettingsRoutes.post("/banda/integrante/borrar", async (c) => {
  const db = drizzle(c.env.DB, { schema: s });
  const memberId = String((await c.req.parseBody())["id"] ?? "");

  await db
    .delete(s.bandMembers)
    .where(and(eq(s.bandMembers.id, memberId), eq(s.bandMembers.bandId, c.get("bandId"))));
  return c.redirect(SAVED, 303);
});

// ---------------------------------------------------------------- advances

/**
 * Advances are dated and carry across events, so one survives a show that
 * underperforms instead of being written off with it.
 */
bandSettingsRoutes.post("/banda/adelanto", async (c) => {
  const db = drizzle(c.env.DB, { schema: s });
  const bandId = c.get("bandId");
  const body = await c.req.parseBody();
  const memberId = String(body["member_id"] ?? "");
  const eventId = String(body["event_id"] ?? "") || null;
  const amount = lpsToCentavos(String(body["amount"] ?? ""));

  if (!memberId || amount == null || amount === 0) {
    return renderBandSettings(c, { error: "Revisá el integrante y el monto." });
  }

  // Both ids arrive in the form body, so neither can be trusted. The same
  // message answers a missing member and a stranger's member, so the form
  // cannot be used to discover which ids exist.
  if (!(await findBandMember(db, bandId, memberId))) {
    return renderBandSettings(c, { error: "Revisá el integrante y el monto." });
  }
  if (eventId && !(await findBandEventById(db, bandId, eventId))) {
    return renderBandSettings(c, { error: "Revisá el integrante y el monto." });
  }

  await db.insert(s.advances).values({
    id: newId("adv"),
    bandId,
    memberId,
    eventId,
    amount,
    date: nowIso().slice(0, 10),
    note: null,
  });
  return c.redirect(SAVED, 303);
});

bandSettingsRoutes.post("/banda/adelanto/borrar", async (c) => {
  const db = drizzle(c.env.DB, { schema: s });
  const advanceId = String((await c.req.parseBody())["id"] ?? "");

  await db
    .delete(s.advances)
    .where(and(eq(s.advances.id, advanceId), eq(s.advances.bandId, c.get("bandId"))));
  return c.redirect(SAVED, 303);
});
