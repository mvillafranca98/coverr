import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import { findBand } from "../../db/queries/bands";
import { findEventBySlug, uniqueEventSlug } from "../../db/queries/events";
import { unpaidFeeFor } from "../../db/queries/fees";
import { confirmedTicketCount } from "../../db/queries/orders";
import * as s from "../../db/schema";
import { newId, newStaffToken, nowIso } from "../../lib/core";
import {
  type EventInput,
  REFUND_TEXT,
  readEventForm,
  typedEventValues,
} from "../../lib/event-form";
import { EventSettingsPage } from "../../views/setup/event-settings";
import { NewEventPage } from "../../views/setup/new-event";
import type { AdminContext, AdminEnv } from "./context";

export const eventSettingsRoutes = new Hono<AdminEnv>();

const settingsPath = (slug: string) => `/admin/e/${slug}/ajustes?saved=1`;

async function renderSettings(
  c: AdminContext,
  opts: { error?: string; saved?: boolean; typed?: Partial<EventInput> } = {},
) {
  const db = drizzle(c.env.DB, { schema: s });
  const bandId = c.get("bandId");
  const slug = c.req.param("slug");
  const band = await findBand(db, bandId);
  const event = slug ? await findEventBySlug(db, bandId, slug) : null;
  if (!band || !event) return c.notFound();

  const rules = await db
    .select()
    .from(s.priceRules)
    .where(eq(s.priceRules.eventId, event.id))
    .orderBy(s.priceRules.sortOrder);

  const soldCount = await confirmedTicketCount(db, event.id);

  return c.html(
    <EventSettingsPage
      bandName={band.name}
      event={event}
      origin={c.env.APP_ORIGIN}
      soldCount={soldCount}
      error={opts.error}
      saved={opts.saved}
      values={{
        name: event.name,
        venue: event.venue,
        startsAt: event.startsAt,
        doorsAt: event.doorsAt,
        description: event.description,
        musicType: event.musicType,
        thankYouNote: event.thankYouNote,
        capacityCap: event.capacityCap,
        refundPolicy: event.refundPolicy,
        refundPolicyText: event.refundPolicyText,
        wristbandsStart: event.wristbandsStart,
        presaleAmount: rules[0]?.amount ?? 20000,
        presaleMaxQty: rules[0]?.maxQty ?? null,
        doorAmount: rules[1]?.amount ?? 25000,
        ...opts.typed,
      }}
    />,
  );
}

/**
 * Two rules, as the model expects: presale runs until doors (or until it sells
 * out), then box office takes over on either trigger. Modelled as a list rather
 * than an enum so adding tiers later is configuration, not a rewrite.
 */
function initialPriceRules(eventId: string, values: EventInput, createdAt: string) {
  const presaleId = newId("pr");
  const boxOfficeStart = values.doorsAt ?? values.startsAt;
  return [
    {
      id: presaleId,
      eventId,
      label: "Preventa",
      amount: values.presaleAmount,
      maxQty: values.presaleMaxQty,
      startsAt: createdAt,
      endsAt: boxOfficeStart,
      activatesOnSelloffOf: null,
      sortOrder: 0,
    },
    {
      id: newId("pr"),
      eventId,
      label: "Taquilla",
      amount: values.doorAmount,
      maxQty: null,
      startsAt: boxOfficeStart,
      endsAt: null,
      activatesOnSelloffOf: presaleId,
      sortOrder: 1,
    },
  ];
}

// --------------------------------------------------------------- new event

eventSettingsRoutes.get("/nuevo", async (c) => {
  const db = drizzle(c.env.DB, { schema: s });
  const band = await findBand(db, c.get("bandId"));
  if (!band) return c.redirect("/admin/salir", 302);

  return c.html(
    <NewEventPage
      bandName={band.name}
      error={c.req.query("error") ?? undefined}
      owed={await unpaidFeeFor(db, band.id)}
    />,
  );
});

eventSettingsRoutes.post("/nuevo", async (c) => {
  const db = drizzle(c.env.DB, { schema: s });
  const bandId = c.get("bandId");
  const band = await findBand(db, bandId);
  if (!band) return c.redirect("/admin/salir", 302);

  // Enforced here, not only by hiding the form: the page may predate the mark.
  const owed = await unpaidFeeFor(db, bandId);
  if (owed) return c.html(<NewEventPage bandName={band.name} owed={owed} />, 403);

  const body = await c.req.parseBody();
  const parsed = readEventForm(body);
  if (!parsed.ok) {
    return c.html(
      <NewEventPage bandName={band.name} error={parsed.message} typed={typedEventValues(body)} />,
      400,
    );
  }
  const values = parsed.values;

  const eventId = newId("evt");
  const slug = await uniqueEventSlug(db, values.name);
  const createdAt = nowIso();

  // Created as a draft: /e/:slug 404s until it is published, so a half-built
  // event can never be bought from.
  await db.insert(s.events).values({
    id: eventId,
    bandId,
    slug,
    name: values.name,
    venue: values.venue,
    startsAt: values.startsAt,
    doorsAt: values.doorsAt,
    description: values.description,
    musicType: values.musicType,
    flyerUrl: null,
    thankYouNote: values.thankYouNote,
    capacityCap: values.capacityCap,
    refundPolicy: values.refundPolicy,
    refundPolicyText: REFUND_TEXT[values.refundPolicy] ?? null,
    wristbandsStart: values.wristbandsStart,
    staffToken: newStaffToken(),
    status: "draft",
    createdAt,
  });

  await db.insert(s.priceRules).values(initialPriceRules(eventId, values, createdAt));

  return c.redirect(settingsPath(slug), 303);
});

// ---------------------------------------------------------------- settings

eventSettingsRoutes.get("/e/:slug/ajustes", (c) =>
  renderSettings(c, { saved: c.req.query("saved") === "1" }),
);

eventSettingsRoutes.post("/e/:slug/ajustes", async (c) => {
  const db = drizzle(c.env.DB, { schema: s });
  const event = await findEventBySlug(db, c.get("bandId"), c.req.param("slug"));
  if (!event) return c.notFound();

  const body = await c.req.parseBody();
  const parsed = readEventForm(body);
  if (!parsed.ok)
    return renderSettings(c, { error: parsed.message, typed: typedEventValues(body) });
  const values = parsed.values;

  await db
    .update(s.events)
    .set({
      name: values.name,
      venue: values.venue,
      startsAt: values.startsAt,
      doorsAt: values.doorsAt,
      description: values.description,
      musicType: values.musicType,
      thankYouNote: values.thankYouNote,
      capacityCap: values.capacityCap,
      refundPolicy: values.refundPolicy,
      refundPolicyText: REFUND_TEXT[values.refundPolicy] ?? null,
      wristbandsStart: values.wristbandsStart,
    })
    .where(eq(s.events.id, event.id));

  // Price changes affect new orders only — every existing order stores the
  // amount it was quoted, so nobody's past purchase silently reprices.
  const rules = await db
    .select()
    .from(s.priceRules)
    .where(eq(s.priceRules.eventId, event.id))
    .orderBy(s.priceRules.sortOrder);
  const boxOfficeStart = values.doorsAt ?? values.startsAt;

  if (rules[0]) {
    await db
      .update(s.priceRules)
      .set({
        amount: values.presaleAmount,
        maxQty: values.presaleMaxQty,
        endsAt: boxOfficeStart,
      })
      .where(eq(s.priceRules.id, rules[0].id));
  }
  if (rules[1]) {
    await db
      .update(s.priceRules)
      .set({ amount: values.doorAmount, startsAt: boxOfficeStart })
      .where(eq(s.priceRules.id, rules[1].id));
  }

  return c.redirect(settingsPath(event.slug), 303);
});

eventSettingsRoutes.post("/e/:slug/ajustes/estado", async (c) => {
  const db = drizzle(c.env.DB, { schema: s });
  const bandId = c.get("bandId");
  const event = await findEventBySlug(db, bandId, c.req.param("slug"));
  if (!event) return c.notFound();

  const wanted = String((await c.req.parseBody())["status"] ?? "");
  const status = wanted === "live" ? "live" : wanted === "closed" ? "closed" : event.status;

  if (status === "live") {
    // Publishing with no bank account would show a buyer a page they cannot
    // pay from, so refuse rather than half-open the sale.
    const accounts = await db
      .select({ id: s.bankAccounts.id })
      .from(s.bankAccounts)
      .where(and(eq(s.bankAccounts.bandId, bandId), eq(s.bankAccounts.active, 1)))
      .limit(1);
    if (accounts.length === 0) {
      return renderSettings(c, {
        error:
          "Agregá al menos una cuenta bancaria antes de publicar — si no, el comprador no tiene a dónde transferir.",
      });
    }
  }

  await db.update(s.events).set({ status }).where(eq(s.events.id, event.id));
  return c.redirect(settingsPath(event.slug), 303);
});

eventSettingsRoutes.post("/e/:slug/ajustes/token", async (c) => {
  const db = drizzle(c.env.DB, { schema: s });
  const event = await findEventBySlug(db, c.get("bandId"), c.req.param("slug"));
  if (!event) return c.notFound();

  // Regenerating invalidates the old link immediately — that is the point when
  // a staff member leaves or a link gets shared too widely.
  await db.update(s.events).set({ staffToken: newStaffToken() }).where(eq(s.events.id, event.id));
  return c.redirect(settingsPath(event.slug), 303);
});
