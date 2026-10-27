import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import { findBand } from "../../db/queries/bands";
import { costsByCategory, eventMetrics, fanStats } from "../../db/queries/stats";
import * as s from "../../db/schema";
import { BandHomePage } from "../../views/band-home";
import type { AdminEnv } from "./context";

export const bandHomeRoutes = new Hono<AdminEnv>();

/**
 * Where a band lands on logging in: every event it has ever run. Never gated —
 * history, trends and the fan list stay open whether or not the next gig has
 * been paid for.
 */
bandHomeRoutes.get("/", async (c) => {
  const db = drizzle(c.env.DB, { schema: s });
  const band = await findBand(db, c.get("bandId"));
  if (!band) return c.redirect("/admin/salir", 302);

  const events = await eventMetrics(c.env.DB, band.id);

  const [bankAccounts, members] = await Promise.all([
    db
      .select({ id: s.bankAccounts.id })
      .from(s.bankAccounts)
      .where(and(eq(s.bankAccounts.bandId, band.id), eq(s.bankAccounts.active, 1)))
      .limit(1),
    db
      .select({ id: s.bandMembers.id })
      .from(s.bandMembers)
      .where(eq(s.bandMembers.bandId, band.id))
      .limit(1),
  ]);

  // Fan stats compare tonight's room against every past one, so they need the
  // most recent event that actually happened — a draft has nobody in it.
  const played = events.filter((e) => e.attendance > 0);
  const [categories, fans] = await Promise.all([
    costsByCategory(c.env.DB, band.id),
    fanStats(c.env.DB, band.id, played[0]?.id ?? null),
  ]);

  return c.html(
    <BandHomePage
      bandName={band.name}
      events={events}
      categories={categories}
      fans={fans}
      setup={{ hasAccount: bankAccounts.length > 0, hasMembers: members.length > 0 }}
    />,
  );
});
