import { drizzle } from "drizzle-orm/d1";
import { type Context, Hono } from "hono";
import { findBand, listBandsByEmail } from "../../db/queries/bands";
import {
  banBand,
  bandEventsForOperator,
  endFreePass,
  endPromo,
  grantFreePass,
  grantPromo,
  listBands,
  operatorActionsFor,
  unbanBand,
} from "../../db/queries/operator";
import * as s from "../../db/schema";
import { nowIso } from "../../lib/core";
import { TEXT_LIMITS, tooLong } from "../../lib/text-limits";
import { OperatorBandPage } from "../../views/operator/band";
import { BandListPage } from "../../views/operator/bands";
import type { OperatorEnv } from "./context";

export const operatorBandRoutes = new Hono<OperatorEnv>();

const PAGE_SIZE = 50;

const bandPath = (bandId: string) => `/operador/bandas/${bandId}`;

/** A whole page number from the query string, 1 when it is missing or nonsense. */
function pageNumber(value: string | undefined): number {
  const page = Number(value);
  return Number.isInteger(page) && page >= 1 ? page : 1;
}

/** Back to the band with a confirmation key, or with a message saying what to fix. */
function backToBand(
  c: Context<OperatorEnv>,
  bandId: string,
  outcome: { done?: string; error?: string },
) {
  const query = outcome.done
    ? `?listo=${outcome.done}`
    : `?error=${encodeURIComponent(outcome.error ?? "")}`;
  return c.redirect(`${bandPath(bandId)}${query}`, 303);
}

/**
 * A last day from a date input: YYYY-MM-DD, or null when left blank, which
 * means no end. Undefined when it is neither, so the caller can say so.
 */
function lastDayFrom(value: unknown): string | null | undefined {
  const day = String(value ?? "").trim();
  if (!day) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(day) && !Number.isNaN(Date.parse(day)) ? day : undefined;
}

/** A whole number from a form field, when it is one within these bounds. */
function wholeNumberFrom(value: unknown, min: number, max: number): number | null {
  const n = Number(String(value ?? "").trim());
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
}

/** The note a form sent, trimmed, with the message if it is over the limit. */
async function noteFrom(c: Context<OperatorEnv>, field: string, label: string) {
  const body = await c.req.parseBody();
  const note = String(body[field] ?? "").trim();
  return { note, body, error: tooLong(note, TEXT_LIMITS.operatorNote, label) };
}

operatorBandRoutes.get("/", async (c) => {
  const search = (c.req.query("q") ?? "").trim().slice(0, TEXT_LIMITS.email);
  const page = pageNumber(c.req.query("pagina"));
  const { rows, total } = await listBands(c.env.DB, {
    search,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });
  return c.html(
    <BandListPage rows={rows} total={total} page={page} pageSize={PAGE_SIZE} search={search} />,
  );
});

operatorBandRoutes.get("/bandas/:id", async (c) => {
  const db = drizzle(c.env.DB, { schema: s });
  const band = await findBand(db, c.req.param("id"));
  if (!band) return c.notFound();

  const [events, actions, sameEmail] = await Promise.all([
    bandEventsForOperator(c.env.DB, band.id),
    operatorActionsFor(db, band.id),
    listBandsByEmail(db, band.contactEmail),
  ]);
  return c.html(
    <OperatorBandPage
      band={band}
      events={events}
      actions={actions}
      siblings={sameEmail.filter((other) => other.id !== band.id)}
      done={c.req.query("listo")}
      error={c.req.query("error")}
    />,
  );
});

operatorBandRoutes.post("/bandas/:id/suspender", async (c) => {
  const db = drizzle(c.env.DB, { schema: s });
  const band = await findBand(db, c.req.param("id"));
  if (!band) return c.notFound();

  const { note: reason, error } = await noteFrom(c, "reason", "El motivo");
  if (error) return backToBand(c, band.id, { error });
  // A ban is the one change a band has to be told about, so it never goes unexplained.
  if (!reason) return backToBand(c, band.id, { error: "Escribí el motivo de la suspensión." });
  if (band.bannedAt) return backToBand(c, band.id, { done: "suspendida" });

  await banBand(db, {
    bandId: band.id,
    operatorEmail: c.get("operatorEmail"),
    reason,
    at: nowIso(),
  });
  return backToBand(c, band.id, { done: "suspendida" });
});

operatorBandRoutes.post("/bandas/:id/reactivar", async (c) => {
  const db = drizzle(c.env.DB, { schema: s });
  const band = await findBand(db, c.req.param("id"));
  if (!band) return c.notFound();

  const { note, error } = await noteFrom(c, "note", "La nota");
  if (error) return backToBand(c, band.id, { error });
  if (!band.bannedAt) return backToBand(c, band.id, { done: "reactivada" });

  await unbanBand(db, {
    bandId: band.id,
    operatorEmail: c.get("operatorEmail"),
    note: note || null,
    at: nowIso(),
  });
  return backToBand(c, band.id, { done: "reactivada" });
});

operatorBandRoutes.post("/bandas/:id/pase", async (c) => {
  const db = drizzle(c.env.DB, { schema: s });
  const band = await findBand(db, c.req.param("id"));
  if (!band) return c.notFound();

  const { note, body, error } = await noteFrom(c, "note", "La nota del pase");
  if (error) return backToBand(c, band.id, { error });
  if (!note) return backToBand(c, band.id, { error: "Escribí para qué es el pase." });

  const until = lastDayFrom(body["until"]);
  if (until === undefined) {
    return backToBand(c, band.id, { error: "Revisá la fecha de fin del pase." });
  }

  await grantFreePass(db, {
    bandId: band.id,
    operatorEmail: c.get("operatorEmail"),
    until,
    note,
    at: nowIso(),
  });
  return backToBand(c, band.id, { done: "pase" });
});

operatorBandRoutes.post("/bandas/:id/pase/quitar", async (c) => {
  const db = drizzle(c.env.DB, { schema: s });
  const band = await findBand(db, c.req.param("id"));
  if (!band) return c.notFound();
  if (!band.freePassGrantedAt) return backToBand(c, band.id, { done: "sin-pase" });

  await endFreePass(db, { bandId: band.id, operatorEmail: c.get("operatorEmail"), at: nowIso() });
  return backToBand(c, band.id, { done: "sin-pase" });
});

/** The most reports one promo can cover: a season, not forever. A free pass is for forever. */
const PROMO_MAX_REPORTS = 20;

operatorBandRoutes.post("/bandas/:id/promo", async (c) => {
  const db = drizzle(c.env.DB, { schema: s });
  const band = await findBand(db, c.req.param("id"));
  if (!band) return c.notFound();

  const { note, body, error } = await noteFrom(c, "note", "La nota de la promo");
  if (error) return backToBand(c, band.id, { error });
  if (!note) return backToBand(c, band.id, { error: "Escribí de qué es la promo." });

  const percent = wholeNumberFrom(body["percent"], 1, 100);
  if (percent === null) {
    return backToBand(c, band.id, { error: "El descuento va de 1 a 100 por ciento." });
  }
  const reports = wholeNumberFrom(body["reports"], 1, PROMO_MAX_REPORTS);
  if (reports === null) {
    return backToBand(c, band.id, {
      error: `La promo cubre de 1 a ${PROMO_MAX_REPORTS} reportes.`,
    });
  }
  const until = lastDayFrom(body["until"]);
  if (until === undefined) {
    return backToBand(c, band.id, { error: "Revisá la fecha de fin de la promo." });
  }

  await grantPromo(db, {
    bandId: band.id,
    operatorEmail: c.get("operatorEmail"),
    percent,
    reports,
    until,
    note,
    at: nowIso(),
  });
  return backToBand(c, band.id, { done: "promo" });
});

operatorBandRoutes.post("/bandas/:id/promo/quitar", async (c) => {
  const db = drizzle(c.env.DB, { schema: s });
  const band = await findBand(db, c.req.param("id"));
  if (!band) return c.notFound();
  if (!band.promoGrantedAt) return backToBand(c, band.id, { done: "sin-promo" });

  await endPromo(db, { bandId: band.id, operatorEmail: c.get("operatorEmail"), at: nowIso() });
  return backToBand(c, band.id, { done: "sin-promo" });
});
