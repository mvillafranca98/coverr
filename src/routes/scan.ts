import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { eq, and, sql, isNull, ne } from "drizzle-orm";
import * as s from "../db/schema";
import { newId, newQrToken, newShortCode, nowIso } from "../lib/core";

type Bindings = {
  DB: D1Database;
  PROOFS: R2Bucket;
  ASSETS: Fetcher;
  APP_ORIGIN: string;
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
};

export const scanApi = new Hono<{ Bindings: Bindings }>();

async function eventForToken(db: ReturnType<typeof drizzle>, token: string) {
  const rows = await db
    .select({ event: s.events, band: s.bands })
    .from(s.events)
    .innerJoin(s.bands, eq(s.events.bandId, s.bands.id))
    .where(eq(s.events.staffToken, token))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Everything the scanner needs to run with no connectivity: the full attendee
 * list, their flags, and the door price. Venues have bad signal and a queue
 * forms in seconds, so validation happens on-device and the network is only
 * ever used to sync afterwards.
 */
scanApi.get("/:token/manifest", async (c) => {
  const db = drizzle(c.env.DB, { schema: s });
  const found = await eventForToken(db, c.req.param("token"));
  if (!found) return c.json({ error: "not_found" }, 404);
  const { event, band } = found;

  const rows = await db
    .select({
      qrToken: s.attendees.qrToken,
      name: s.attendees.name,
      note: s.attendees.note,
      checkedInAt: s.attendees.checkedInAt,
      shortCode: s.orders.shortCode,
      channel: s.orders.channel,
      quantity: s.orders.quantity,
      verificationStatus: s.orders.verificationStatus,
      orderId: s.orders.id,
    })
    .from(s.attendees)
    .innerJoin(s.orders, eq(s.attendees.orderId, s.orders.id))
    .where(and(eq(s.orders.eventId, event.id), eq(s.orders.status, "confirmed")));

  // Open flags become the amber reason shown at the door. Staff resolving a
  // flag in five seconds is the point; staff phoning the admin is the failure.
  //
  // Info-severity flags are excluded deliberately. NAME_MISMATCH is the one
  // that matters: one person paying for four is the common case, not the
  // suspicious one, and surfacing it here would have staff questioning people
  // who did nothing wrong. It stays a weak signal in the admin view only.
  const flags = await db
    .select({ orderId: s.verificationFlags.orderId, detail: s.verificationFlags.detail })
    .from(s.verificationFlags)
    .innerJoin(s.orders, eq(s.verificationFlags.orderId, s.orders.id))
    .where(
      and(
        eq(s.orders.eventId, event.id),
        isNull(s.verificationFlags.resolvedAt),
        ne(s.verificationFlags.severity, "info"),
      ),
    );

  const reasonByOrder = new Map<string, string>();
  for (const f of flags) if (!reasonByOrder.has(f.orderId)) reasonByOrder.set(f.orderId, f.detail);

  const doorRule = await db
    .select()
    .from(s.priceRules)
    .where(eq(s.priceRules.eventId, event.id))
    .orderBy(sql`${s.priceRules.sortOrder} DESC`)
    .limit(1);

  return c.json({
    event: {
      id: event.id,
      name: event.name,
      venue: event.venue,
      startsAt: event.startsAt,
      wristbandsStart: event.wristbandsStart,
    },
    band: { name: band.name },
    doorPrice: doorRule[0]?.amount ?? 0,
    doorPriceLabel: doorRule[0]?.label ?? "Taquilla",
    attendees: rows.map((r) => ({
      t: r.qrToken,
      n: r.name,
      no: r.note,
      c: r.checkedInAt,
      sc: r.shortCode,
      ch: r.channel,
      q: r.quantity,
      f: reasonByOrder.get(r.orderId) ?? null,
    })),
    syncedAt: nowIso(),
  });
});

/**
 * Applies queued scans. Offline devices can't coordinate, so a cross-device
 * double scan is detected here at sync rather than prevented at the door —
 * preventing it would need the connectivity the venue doesn't have. The
 * wristband is the real anti-passback control.
 */
scanApi.post("/:token/checkin", async (c) => {
  const db = drizzle(c.env.DB, { schema: s });
  const found = await eventForToken(db, c.req.param("token"));
  if (!found) return c.json({ error: "not_found" }, 404);

  const body = (await c.req.json()) as {
    scans?: { t: string; at: string; device?: string }[];
  };
  const scans = Array.isArray(body.scans) ? body.scans.slice(0, 500) : [];
  const results: {
    t: string;
    status: "ok" | "already" | "unknown" | "voided";
    at?: string;
    by?: string;
  }[] = [];

  for (const scan of scans) {
    if (typeof scan?.t !== "string") continue;
    const hit = await db
      .select({
        id: s.attendees.id,
        checkedInAt: s.attendees.checkedInAt,
        checkedInDevice: s.attendees.checkedInDevice,
        orderStatus: s.orders.status,
      })
      .from(s.attendees)
      .innerJoin(s.orders, eq(s.attendees.orderId, s.orders.id))
      .where(and(eq(s.attendees.qrToken, scan.t), eq(s.orders.eventId, found.event.id)))
      .limit(1);

    const row = hit[0];
    if (!row) {
      results.push({ t: scan.t, status: "unknown" });
      continue;
    }
    // The manifest already excludes refunded and voided orders, but a device
    // holding a stale cache would still queue the scan — so the server refuses
    // it rather than trusting whatever the client had downloaded.
    if (row.orderStatus !== "confirmed") {
      results.push({ t: scan.t, status: "voided" });
      continue;
    }
    if (row.checkedInAt) {
      results.push({
        t: scan.t,
        status: "already",
        at: row.checkedInAt,
        by: row.checkedInDevice ?? undefined,
      });
      continue;
    }
    await db
      .update(s.attendees)
      .set({
        checkedInAt: scan.at ?? nowIso(),
        checkedInDevice: scan.device ?? null,
      })
      .where(eq(s.attendees.id, row.id));
    results.push({ t: scan.t, status: "ok" });
  }

  const [counts] = await db
    .select({
      total: sql<number>`count(*)`,
      inside: sql<number>`sum(case when ${s.attendees.checkedInAt} is not null then 1 else 0 end)`,
    })
    .from(s.attendees)
    .innerJoin(s.orders, eq(s.attendees.orderId, s.orders.id))
    .where(and(eq(s.orders.eventId, found.event.id), eq(s.orders.status, "confirmed")));

  return c.json({
    results,
    total: Number(counts?.total ?? 0),
    inside: Number(counts?.inside ?? 0),
  });
});

/**
 * Cash at the door. 39% of the last event's door take was cash and nothing
 * recorded it, which is a large part of why the headcount never matched.
 * One tap: a confirmed order, a ticket record, already checked in.
 */
scanApi.post("/:token/cash", async (c) => {
  const db = drizzle(c.env.DB, { schema: s });
  const found = await eventForToken(db, c.req.param("token"));
  if (!found) return c.json({ error: "not_found" }, 404);
  const { event, band } = found;

  const body = (await c.req.json()) as { quantity?: number; device?: string; comp?: boolean };
  const quantity = Math.min(20, Math.max(1, Math.floor(Number(body.quantity) || 1)));
  const isComp = body.comp === true;

  const doorRule = await db
    .select()
    .from(s.priceRules)
    .where(eq(s.priceRules.eventId, event.id))
    .orderBy(sql`${s.priceRules.sortOrder} DESC`)
    .limit(1);
  const unit = isComp ? 0 : (doorRule[0]?.amount ?? 0);

  const ts = nowIso();
  const orderId = newId("ord");
  await db.insert(s.orders).values({
    id: orderId,
    eventId: event.id,
    shortCode: newShortCode(band.slug),
    payerName: isComp ? "Cortesía" : "Venta en efectivo",
    payerEmail: `${isComp ? "comp" : "cash"}+${orderId}@door.local`,
    payerPhone: null,
    quantity,
    priceRuleId: isComp ? null : (doorRule[0]?.id ?? null),
    expectedAmount: unit * quantity,
    channel: isComp ? "comp" : "door_cash",
    status: "confirmed",
    verificationStatus: "manual_ok",
    bankSelected: null,
    soldBy: body.device ?? null,
    createdAt: ts,
  });

  // Cash buyers are standing at the door, so they are checked in on the spot.
  // The wristband is their token — no QR needs to change hands.
  await db.insert(s.attendees).values(
    Array.from({ length: quantity }, (_, i) => ({
      id: newId("att"),
      orderId,
      name: isComp ? `Cortesía ${i + 1}` : `Efectivo ${i + 1}`,
      note: null,
      qrToken: newQrToken(),
      checkedInAt: ts,
      checkedInBy: null,
      checkedInDevice: body.device ?? null,
    })),
  );

  const [counts] = await db
    .select({
      total: sql<number>`count(*)`,
      inside: sql<number>`sum(case when ${s.attendees.checkedInAt} is not null then 1 else 0 end)`,
      cash: sql<number>`sum(case when ${s.orders.channel} = 'door_cash' then 1 else 0 end)`,
    })
    .from(s.attendees)
    .innerJoin(s.orders, eq(s.attendees.orderId, s.orders.id))
    .where(and(eq(s.orders.eventId, event.id), eq(s.orders.status, "confirmed")));

  return c.json({
    ok: true,
    quantity,
    amount: unit * quantity,
    total: Number(counts?.total ?? 0),
    inside: Number(counts?.inside ?? 0),
    cash: Number(counts?.cash ?? 0),
  });
});

/** Live counts for the header, including the wristband cross-check. */
scanApi.get("/:token/stats", async (c) => {
  const db = drizzle(c.env.DB, { schema: s });
  const found = await eventForToken(db, c.req.param("token"));
  if (!found) return c.json({ error: "not_found" }, 404);

  const [counts] = await db
    .select({
      total: sql<number>`count(*)`,
      inside: sql<number>`sum(case when ${s.attendees.checkedInAt} is not null then 1 else 0 end)`,
      cash: sql<number>`sum(case when ${s.orders.channel} = 'door_cash' then 1 else 0 end)`,
      comp: sql<number>`sum(case when ${s.orders.channel} = 'comp' then 1 else 0 end)`,
    })
    .from(s.attendees)
    .innerJoin(s.orders, eq(s.attendees.orderId, s.orders.id))
    .where(and(eq(s.orders.eventId, found.event.id), eq(s.orders.status, "confirmed")));

  const inside = Number(counts?.inside ?? 0);
  return c.json({
    total: Number(counts?.total ?? 0),
    inside,
    cash: Number(counts?.cash ?? 0),
    comp: Number(counts?.comp ?? 0),
    wristbandsStart: found.event.wristbandsStart,
    wristbandsLeft:
      found.event.wristbandsStart != null ? found.event.wristbandsStart - inside : null,
  });
});
