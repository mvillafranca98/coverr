import { Hono, type Context } from "hono";
import { drizzle, type DrizzleD1Database } from "drizzle-orm/d1";
import { eq, and, sql, isNull, desc } from "drizzle-orm";
import * as s from "../db/schema";
import {
  AdminLayout,
  LoginPage,
  DashboardPage,
  OrdersPage,
  OrderPage,
  MoneyPage,
} from "../views/admin";
import { BandHomePage } from "../views/home";
import { ManualSalePage } from "../views/manual";
import { NewEventPage, EventSettingsPage, BandSettingsPage } from "../views/setup";
import { eventMetrics, costsByCategory, fanStats } from "../lib/stats";
import { computeSettlement, priceBracket, BILLING_ENABLED } from "../lib/settlement";
import { makeTransport } from "../lib/email";
import {
  sign,
  verify,
  SESSION_COOKIE,
  LOGIN_TTL,
  SESSION_TTL,
  sessionCookie,
  clearCookie,
  readCookie,
} from "../lib/auth";
import {
  newId, nowIso, normalizeEmail, escapeHtml,
  newStaffToken, slugify, localInputToIso, lpsToCentavos,
  newShortCode, newQrToken,
} from "../lib/core";
import { runVerification } from "../lib/pipeline";
import { sendTickets } from "../lib/tickets";

type Bindings = {
  DB: D1Database;
  PROOFS: R2Bucket;
  ASSETS: Fetcher;
  APP_ORIGIN: string;
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
  SESSION_SECRET?: string;
  ANTHROPIC_API_KEY?: string;
};

type Vars = { bandId: string };

type Ctx = Context<{ Bindings: Bindings; Variables: Vars }>;

export const admin = new Hono<{ Bindings: Bindings; Variables: Vars }>();

function secretOf(env: Bindings): string {
  // Without a configured secret the admin is not safe to serve at all, so fail
  // loudly rather than silently signing sessions with a guessable constant.
  const v = env.SESSION_SECRET;
  if (!v) throw new Error("SESSION_SECRET is not configured");
  return v;
}

const isHttps = (origin: string) => origin.startsWith("https://");

/** Everything under /admin except the login pages requires a valid session. */
admin.use("*", async (c, next) => {
  const path = new URL(c.req.url).pathname;
  if (
    path === "/admin/login" ||
    path === "/admin/entrar" ||
    path === "/admin/salir" ||
    path === "/admin/acceso"
  ) {
    return next();
  }
  const raw = readCookie(c.req.header("Cookie"), SESSION_COOKIE);
  if (!raw) return c.redirect("/admin/acceso", 302);
  const payload = await verify<{ b: string }>(secretOf(c.env), raw);
  if (!payload?.b) return c.redirect("/admin/acceso", 302);
  c.set("bandId", payload.b);
  return next();
});

// ------------------------------------------------------------------- login

admin.get("/acceso", (c) => c.html(<LoginPage sent={c.req.query("ok") === "1"} />));

admin.post("/login", async (c) => {
  const body = await c.req.parseBody();
  const email = typeof body["email"] === "string" ? normalizeEmail(body["email"]) : "";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return c.html(<LoginPage error="Revisá el correo que escribiste." />, 400);
  }

  const db = drizzle(c.env.DB, { schema: s });
  const hit = await db.select().from(s.bands).where(eq(s.bands.contactEmail, email)).limit(1);

  // Send only when it matches, but answer identically either way — otherwise
  // this page tells anyone which addresses run a band.
  if (hit[0]) {
    const band = hit[0];
    const token = await sign(secretOf(c.env), { b: band.id }, LOGIN_TTL);
    const url = `${c.env.APP_ORIGIN}/admin/entrar?t=${encodeURIComponent(token)}`;
    c.executionCtx.waitUntil(
      makeTransport(c.env)
        .send({
          to: email,
          subject: "Entrar a Coverr",
          html: `<!doctype html><html lang="es"><body style="margin:0;background:#f3f1ea;padding:28px 14px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif">
<table role="presentation" width="100%"><tr><td align="center">
<table role="presentation" width="100%" style="max-width:440px;text-align:left">
<tr><td style="font:600 11px/1 ui-monospace,Menlo,monospace;letter-spacing:.2em;text-transform:uppercase;color:#b0651a;padding-bottom:10px">Coverr</td></tr>
<tr><td style="font:700 22px/1.2 inherit;color:#191713;padding-bottom:10px">Entrar al panel de ${escapeHtml(band.name)}</td></tr>
<tr><td style="font:400 15px/1.5 inherit;color:#57534b;padding-bottom:20px">Tocá el botón para entrar. El enlace vence en 15 minutos.</td></tr>
<tr><td><a href="${url}" style="display:inline-block;padding:13px 22px;border-radius:9px;background:#191713;color:#fff;font:600 15px/1 inherit;text-decoration:none">Entrar</a></td></tr>
<tr><td style="font:400 12px/1.6 inherit;color:#8a857b;padding-top:22px">Si no pediste esto, ignoralo — nadie puede entrar sin este correo.</td></tr>
</table></td></tr></table></body></html>`,
          text: `Entrar al panel de ${band.name}:\n\n${url}\n\nEl enlace vence en 15 minutos. Si no pediste esto, ignoralo.`,
        })
        .then((r) => {
          if (!r.ok) console.error(`[admin] magic link failed for ${email}: ${r.error}`);
        }),
    );
  }
  return c.redirect("/admin/acceso?ok=1", 303);
});

admin.get("/entrar", async (c) => {
  const t = c.req.query("t");
  if (!t) return c.redirect("/admin/acceso", 302);
  const payload = await verify<{ b: string }>(secretOf(c.env), t);
  if (!payload?.b) {
    return c.html(<LoginPage error="Ese enlace ya venció. Pedí uno nuevo." />, 400);
  }
  const session = await sign(secretOf(c.env), { b: payload.b }, SESSION_TTL);
  c.header("Set-Cookie", sessionCookie(session, isHttps(c.env.APP_ORIGIN)));
  return c.redirect("/admin", 302);
});

admin.get("/salir", (c) => {
  c.header("Set-Cookie", clearCookie(isHttps(c.env.APP_ORIGIN)));
  return c.redirect("/admin/acceso", 302);
});

// ------------------------------------------------------------------ helpers

async function bandOf(db: DrizzleD1Database<typeof s>, bandId: string) {
  const r = await db.select().from(s.bands).where(eq(s.bands.id, bandId)).limit(1);
  return r[0] ?? null;
}

async function eventOf(db: DrizzleD1Database<typeof s>, bandId: string, slug: string) {
  const r = await db
    .select()
    .from(s.events)
    .where(and(eq(s.events.slug, slug), eq(s.events.bandId, bandId)))
    .limit(1);
  return r[0] ?? null;
}

/** Revenue and headcount per channel. Comps contribute people, never money. */
async function channelTotals(db: DrizzleD1Database<typeof s>, eventId: string) {
  const rows = await db
    .select({
      channel: s.orders.channel,
      people: sql<number>`sum(${s.orders.quantity})`,
      amount: sql<number>`sum(${s.orders.expectedAmount})`,
    })
    .from(s.orders)
    .where(and(eq(s.orders.eventId, eventId), eq(s.orders.status, "confirmed")))
    .groupBy(s.orders.channel);

  const by = (ch: string) => rows.find((r) => r.channel === ch);
  const counts = {
    presale: Number(by("online")?.people ?? 0),
    doorOnline: Number(by("door_online")?.people ?? 0),
    doorCash: Number(by("door_cash")?.people ?? 0),
    manual: Number(by("manual")?.people ?? 0),
    comp: Number(by("comp")?.people ?? 0),
    sold: 0,
    inside: 0,
  };
  counts.sold =
    counts.presale + counts.doorOnline + counts.doorCash + counts.manual + counts.comp;

  const channels = {
    presale: Number(by("online")?.amount ?? 0),
    doorTransfer: Number(by("door_online")?.amount ?? 0),
    doorCash: Number(by("door_cash")?.amount ?? 0),
    manual: Number(by("manual")?.amount ?? 0),
    comp: 0,
  };

  const [inside] = await db
    .select({ n: sql<number>`count(*)` })
    .from(s.attendees)
    .innerJoin(s.orders, eq(s.attendees.orderId, s.orders.id))
    .where(
      and(
        eq(s.orders.eventId, eventId),
        eq(s.orders.status, "confirmed"),
        sql`${s.attendees.checkedInAt} is not null`,
      ),
    );
  counts.inside = Number(inside?.n ?? 0);

  return { counts, channels };
}

async function settlementFor(db: DrizzleD1Database<typeof s>, bandId: string, eventId: string) {
  const { counts, channels } = await channelTotals(db, eventId);

  const [costRow] = await db
    .select({ n: sql<number>`coalesce(sum(${s.expenses.amount}), 0)` })
    .from(s.expenses)
    .where(eq(s.expenses.eventId, eventId));

  const members = await db
    .select()
    .from(s.bandMembers)
    .where(eq(s.bandMembers.bandId, bandId))
    .orderBy(s.bandMembers.sortOrder);

  const advRows = await db
    .select({
      memberId: s.advances.memberId,
      total: sql<number>`coalesce(sum(${s.advances.amount}), 0)`,
    })
    .from(s.advances)
    .where(and(eq(s.advances.bandId, bandId), eq(s.advances.eventId, eventId)))
    .groupBy(s.advances.memberId);
  const advBy = new Map(advRows.map((a) => [a.memberId, Number(a.total)]));

  return {
    counts,
    channels,
    settlement: computeSettlement({
      channels,
      costs: Number(costRow?.n ?? 0),
      headcount: counts.sold,
      members: members.map((m) => ({
        id: m.id,
        name: m.name,
        splitPct: m.splitPct,
        advances: advBy.get(m.id) ?? 0,
      })),
    }),
    advancesByMember: Object.fromEntries(advBy),
  };
}

// ------------------------------------------------------------- event list

admin.get("/", async (c) => {
  const db = drizzle(c.env.DB, { schema: s });
  const band = await bandOf(db, c.get("bandId"));
  if (!band) return c.redirect("/admin/salir", 302);

  const events = await eventMetrics(c.env.DB, band.id);
  const [accts, mems] = await Promise.all([
    db.select({ id: s.bankAccounts.id }).from(s.bankAccounts)
      .where(and(eq(s.bankAccounts.bandId, band.id), eq(s.bankAccounts.active, 1))).limit(1),
    db.select({ id: s.bandMembers.id }).from(s.bandMembers)
      .where(eq(s.bandMembers.bandId, band.id)).limit(1),
  ]);
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
      setup={{ hasAccount: accts.length > 0, hasMembers: mems.length > 0 }}
    />,
  );
});

// -------------------------------------------------------------- dashboard

admin.get("/e/:slug", async (c) => {
  const db = drizzle(c.env.DB, { schema: s });
  const bandId = c.get("bandId");
  const band = await bandOf(db, bandId);
  const event = await eventOf(db, bandId, c.req.param("slug"));
  if (!band || !event) return c.notFound();

  const { counts, channels, settlement } = await settlementFor(db, bandId, event.id);

  const byAccount = await db
    .select({
      bank: s.orders.bankSelected,
      count: sql<number>`count(*)`,
      amount: sql<number>`sum(${s.orders.expectedAmount})`,
    })
    .from(s.orders)
    .where(
      and(
        eq(s.orders.eventId, event.id),
        eq(s.orders.status, "confirmed"),
        sql`${s.orders.bankSelected} is not null`,
      ),
    )
    .groupBy(s.orders.bankSelected);

  const [flagCount] = await db
    .select({ n: sql<number>`count(*)` })
    .from(s.verificationFlags)
    .innerJoin(s.orders, eq(s.verificationFlags.orderId, s.orders.id))
    .where(and(eq(s.orders.eventId, event.id), isNull(s.verificationFlags.resolvedAt)));

  const [refundCount] = await db
    .select({ n: sql<number>`count(*)` })
    .from(s.refundRequests)
    .innerJoin(s.orders, eq(s.refundRequests.orderId, s.orders.id))
    .where(and(eq(s.orders.eventId, event.id), eq(s.refundRequests.status, "open")));

  return c.html(
    <DashboardPage
      bandName={band.name}
      openRefunds={Number(refundCount?.n ?? 0)}
      event={event}
      counts={counts}
      channels={channels}
      byAccount={byAccount.map((a) => ({
        bank: a.bank ?? "OTHER",
        count: Number(a.count),
        amount: Number(a.amount),
      }))}
      wristbands={{
        start: event.wristbandsStart,
        left: event.wristbandsStart != null ? event.wristbandsStart - counts.inside : null,
      }}
      openFlags={Number(flagCount?.n ?? 0)}
      settlement={settlement}
      scanUrl={event.staffToken ? `${c.env.APP_ORIGIN}/scan/${event.staffToken}` : null}
    />,
  );
});

// ----------------------------------------------------------------- orders

async function orderRows(
  db: DrizzleD1Database<typeof s>,
  eventId: string,
  opts: { q?: string; filter?: string } = {},
) {
  const rows = await db
    .select({
      id: s.orders.id,
      shortCode: s.orders.shortCode,
      payerName: s.orders.payerName,
      payerEmail: s.orders.payerEmail,
      payerPhone: s.orders.payerPhone,
      quantity: s.orders.quantity,
      expectedAmount: s.orders.expectedAmount,
      channel: s.orders.channel,
      status: s.orders.status,
      verificationStatus: s.orders.verificationStatus,
      bankSelected: s.orders.bankSelected,
      note: s.orders.note,
      createdAt: s.orders.createdAt,
    })
    .from(s.orders)
    .where(eq(s.orders.eventId, eventId))
    .orderBy(desc(s.orders.createdAt));

  // Join on the event rather than enumerating order ids: an `inArray` of every
  // order blows D1's bound-parameter limit the moment an event sells properly.
  const atts = await db
    .select({
      orderId: s.attendees.orderId,
      name: s.attendees.name,
      checkedInAt: s.attendees.checkedInAt,
    })
    .from(s.attendees)
    .innerJoin(s.orders, eq(s.attendees.orderId, s.orders.id))
    .where(eq(s.orders.eventId, eventId));

  const flags = await db
    .select({ orderId: s.verificationFlags.orderId, detail: s.verificationFlags.detail })
    .from(s.verificationFlags)
    .innerJoin(s.orders, eq(s.verificationFlags.orderId, s.orders.id))
    .where(and(eq(s.orders.eventId, eventId), isNull(s.verificationFlags.resolvedAt)));

  const byOrder = new Map<string, { name: string; checkedInAt: string | null }[]>();
  for (const a of atts) {
    const list = byOrder.get(a.orderId) ?? [];
    list.push({ name: a.name, checkedInAt: a.checkedInAt });
    byOrder.set(a.orderId, list);
  }
  const flagBy = new Map<string, string>();
  for (const f of flags) if (!flagBy.has(f.orderId)) flagBy.set(f.orderId, f.detail);

  const openRefunds = await db
    .select({ orderId: s.refundRequests.orderId })
    .from(s.refundRequests)
    .innerJoin(s.orders, eq(s.refundRequests.orderId, s.orders.id))
    .where(and(eq(s.orders.eventId, eventId), eq(s.refundRequests.status, "open")));
  const refundSet = new Set(openRefunds.map((r) => r.orderId));

  let out = rows.map((r) => {
    const list = byOrder.get(r.id) ?? [];
    return {
      ...r,
      attendees: list.map((a) => a.name).join(", "),
      checkedIn: list.filter((a) => a.checkedInAt).length,
      flag: flagBy.get(r.id) ?? null,
    };
  });

  const q = (opts.q ?? "").trim().toLowerCase();
  if (q) {
    out = out.filter(
      (o) =>
        o.payerName.toLowerCase().includes(q) ||
        o.payerEmail.toLowerCase().includes(q) ||
        o.shortCode.toLowerCase().includes(q) ||
        o.attendees.toLowerCase().includes(q),
    );
  }
  switch (opts.filter) {
    case "flagged":
      out = out.filter((o) => o.flag);
      break;
    case "inside":
      out = out.filter((o) => o.checkedIn > 0);
      break;
    case "refunds":
      out = out.filter((o) => refundSet.has(o.id));
      break;
    case "online":
    case "door_cash":
    case "manual":
    case "comp":
      out = out.filter((o) => o.channel === opts.filter);
      break;
  }
  return out;
}

admin.get("/e/:slug/ordenes", async (c) => {
  const db = drizzle(c.env.DB, { schema: s });
  const bandId = c.get("bandId");
  const band = await bandOf(db, bandId);
  const event = await eventOf(db, bandId, c.req.param("slug"));
  if (!band || !event) return c.notFound();

  const q = c.req.query("q") ?? "";
  const filter = c.req.query("filtro") ?? "";
  const orders = await orderRows(db, event.id, { q, filter });

  return c.html(
    <OrdersPage
      bandName={band.name}
      event={event}
      orders={orders}
      q={q}
      filter={filter}
      total={orders.length}
    />,
  );
});

admin.get("/e/:slug/ordenes.csv", async (c) => {
  const db = drizzle(c.env.DB, { schema: s });
  const bandId = c.get("bandId");
  const event = await eventOf(db, bandId, c.req.param("slug"));
  if (!event) return c.notFound();

  const rows = await orderRows(db, event.id);
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [
    ["codigo", "comprador", "correo", "telefono", "asistentes", "cantidad", "adentro", "canal", "monto_lps", "estado", "banco", "fecha", "nota", "alerta"]
      .map(esc)
      .join(","),
    ...rows.map((r) =>
      [
        r.shortCode, r.payerName, r.payerEmail, r.payerPhone ?? "", r.attendees,
        r.quantity, r.checkedIn, r.channel, (r.expectedAmount / 100).toFixed(2),
        r.status, r.bankSelected ?? "", r.createdAt, r.note ?? "", r.flag ?? "",
      ]
        .map(esc)
        .join(","),
    ),
  ].join("\r\n");

  return c.body("﻿" + csv, 200, {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="ordenes-${event.slug}.csv"`,
  });
});

// ----------------------------------------------------------- order detail

admin.get("/e/:slug/orden/:id", async (c) => {
  const db = drizzle(c.env.DB, { schema: s });
  const bandId = c.get("bandId");
  const band = await bandOf(db, bandId);
  const event = await eventOf(db, bandId, c.req.param("slug"));
  if (!band || !event) return c.notFound();

  const all = await orderRows(db, event.id);
  const order = all.find((o) => o.id === c.req.param("id"));
  if (!order) return c.notFound();

  const attendees = await db
    .select()
    .from(s.attendees)
    .where(eq(s.attendees.orderId, order.id));
  const proofs = await db
    .select()
    .from(s.paymentProofs)
    .where(eq(s.paymentProofs.orderId, order.id))
    .limit(1);
  const flags = await db
    .select()
    .from(s.verificationFlags)
    .where(eq(s.verificationFlags.orderId, order.id));
  const refunds = await db
    .select()
    .from(s.refundRequests)
    .where(eq(s.refundRequests.orderId, order.id))
    .orderBy(desc(s.refundRequests.requestedAt))
    .limit(1);

  return c.html(
    <OrderPage
      bandName={band.name}
      event={event}
      order={order}
      attendees={attendees}
      proof={proofs[0] ?? null}
      flags={flags}
      refund={refunds[0] ?? null}
    />,
  );
});

/** Proofs are third-party banking details — served only behind a session. */
admin.get("/e/:slug/orden/:id/comprobante", async (c) => {
  const db = drizzle(c.env.DB, { schema: s });
  const bandId = c.get("bandId");
  const event = await eventOf(db, bandId, c.req.param("slug"));
  if (!event) return c.notFound();

  const rows = await db
    .select({ proof: s.paymentProofs })
    .from(s.paymentProofs)
    .innerJoin(s.orders, eq(s.paymentProofs.orderId, s.orders.id))
    .where(and(eq(s.paymentProofs.orderId, c.req.param("id")), eq(s.orders.eventId, event.id)))
    .limit(1);
  const proof = rows[0]?.proof;
  if (!proof) return c.notFound();

  const obj = await c.env.PROOFS.get(proof.fileKey);
  if (!obj) return c.notFound();

  return c.body(obj.body, 200, {
    "Content-Type": proof.contentType,
    "Cache-Control": "private, no-store",
  });
});

admin.post("/e/:slug/orden/:id/resolver", async (c) => {
  const db = drizzle(c.env.DB, { schema: s });
  const bandId = c.get("bandId");
  const event = await eventOf(db, bandId, c.req.param("slug"));
  if (!event) return c.notFound();
  const body = await c.req.parseBody();
  const flagId = String(body["flag_id"] ?? "");

  await db
    .update(s.verificationFlags)
    .set({ resolvedAt: nowIso(), resolvedBy: bandId, resolutionNote: "Revisado desde el panel" })
    .where(and(eq(s.verificationFlags.id, flagId), eq(s.verificationFlags.orderId, c.req.param("id"))));

  const [left] = await db
    .select({ n: sql<number>`count(*)` })
    .from(s.verificationFlags)
    .where(
      and(eq(s.verificationFlags.orderId, c.req.param("id")), isNull(s.verificationFlags.resolvedAt)),
    );
  if (Number(left?.n ?? 0) === 0) {
    await db
      .update(s.orders)
      .set({ verificationStatus: "manual_ok" })
      .where(eq(s.orders.id, c.req.param("id")));
  }
  return c.redirect(`/admin/e/${event.slug}/orden/${c.req.param("id")}`, 303);
});

/** Renaming an attendee is the whole of "transfer this ticket to someone else". */
/** Re-run extraction — useful after a failed read or a fixed upload. */
admin.post("/e/:slug/orden/:id/revisar", async (c) => {
  const db = drizzle(c.env.DB, { schema: s });
  const event = await eventOf(db, c.get("bandId"), c.req.param("slug"));
  if (!event) return c.notFound();
  await runVerification(c.env, c.req.param("id"));
  return c.redirect(`/admin/e/${event.slug}/orden/${c.req.param("id")}`, 303);
});

admin.post("/e/:slug/orden/:id/asistente", async (c) => {
  const db = drizzle(c.env.DB, { schema: s });
  const bandId = c.get("bandId");
  const event = await eventOf(db, bandId, c.req.param("slug"));
  if (!event) return c.notFound();

  const body = await c.req.parseBody();
  const attendeeId = String(body["attendee_id"] ?? "");
  const name = String(body["name"] ?? "").trim();
  if (name) {
    await db
      .update(s.attendees)
      .set({ name })
      .where(and(eq(s.attendees.id, attendeeId), eq(s.attendees.orderId, c.req.param("id"))));
  }
  return c.redirect(`/admin/e/${event.slug}/orden/${c.req.param("id")}`, 303);
});

admin.post("/e/:slug/orden/:id/anular", async (c) => {
  const db = drizzle(c.env.DB, { schema: s });
  const bandId = c.get("bandId");
  const event = await eventOf(db, bandId, c.req.param("slug"));
  if (!event) return c.notFound();

  // Void rather than delete: the history stays, the QR stops scanning, and the
  // totals drop because every aggregate filters on status = 'confirmed'.
  await db
    .update(s.orders)
    .set({ status: "void" })
    .where(and(eq(s.orders.id, c.req.param("id")), eq(s.orders.eventId, event.id)));

  return c.redirect(`/admin/e/${event.slug}/ordenes`, 303);
});

// ------------------------------------------------------------------ money

admin.get("/e/:slug/dinero", async (c) => {
  const db = drizzle(c.env.DB, { schema: s });
  const bandId = c.get("bandId");
  const band = await bandOf(db, bandId);
  const event = await eventOf(db, bandId, c.req.param("slug"));
  if (!band || !event) return c.notFound();

  const { settlement, advancesByMember, counts } = await settlementFor(db, bandId, event.id);
  const expenses = await db
    .select()
    .from(s.expenses)
    .where(eq(s.expenses.eventId, event.id))
    .orderBy(s.expenses.createdAt);

  const unlock = await db
    .select()
    .from(s.eventUnlocks)
    .where(eq(s.eventUnlocks.eventId, event.id))
    .limit(1);

  // Comps are free tickets; charging for them would be indefensible.
  const paidTickets = counts.sold - counts.comp;
  const priorUnlocks = await db
    .select({ n: sql<number>`count(*)` })
    .from(s.eventUnlocks)
    .innerJoin(s.events, eq(s.eventUnlocks.eventId, s.events.id))
    .where(eq(s.events.bandId, bandId));

  return c.html(
    <MoneyPage
      bandName={band.name}
      event={event}
      expenses={expenses}
      settlement={settlement}
      advancesByMember={advancesByMember}
      unlocked={!BILLING_ENABLED || !!unlock[0]}
      bracket={priceBracket(paidTickets)}
      isFirstEvent={Number(priorUnlocks[0]?.n ?? 0) === 0}
    />,
  );
});

admin.post("/e/:slug/dinero/costo", async (c) => {
  const db = drizzle(c.env.DB, { schema: s });
  const bandId = c.get("bandId");
  const event = await eventOf(db, bandId, c.req.param("slug"));
  if (!event) return c.notFound();

  const body = await c.req.parseBody();
  const label = String(body["label"] ?? "").trim();
  const category = String(body["category"] ?? "other");
  const lps = Number(body["amount"]);
  if (label && Number.isFinite(lps) && lps >= 0) {
    await db.insert(s.expenses).values({
      id: newId("exp"),
      eventId: event.id,
      label,
      category,
      amount: Math.round(lps * 100), // centavos, always
      note: null,
      paid: 0,
      createdAt: nowIso(),
    });
  }
  return c.redirect(`/admin/e/${event.slug}/dinero`, 303);
});

admin.post("/e/:slug/dinero/costo/borrar", async (c) => {
  const db = drizzle(c.env.DB, { schema: s });
  const bandId = c.get("bandId");
  const event = await eventOf(db, bandId, c.req.param("slug"));
  if (!event) return c.notFound();
  const body = await c.req.parseBody();
  await db
    .delete(s.expenses)
    .where(and(eq(s.expenses.id, String(body["id"] ?? "")), eq(s.expenses.eventId, event.id)));
  return c.redirect(`/admin/e/${event.slug}/dinero`, 303);
});

admin.post("/e/:slug/dinero/desbloquear", async (c) => {
  const db = drizzle(c.env.DB, { schema: s });
  const bandId = c.get("bandId");
  const event = await eventOf(db, bandId, c.req.param("slug"));
  if (!event) return c.notFound();
  // Nothing to unlock while billing is off; the report is already showing.
  if (!BILLING_ENABLED) return c.redirect(`/admin/e/${event.slug}/dinero`, 303);

  const existing = await db
    .select()
    .from(s.eventUnlocks)
    .where(eq(s.eventUnlocks.eventId, event.id))
    .limit(1);
  if (existing[0]) return c.redirect(`/admin/e/${event.slug}/dinero`, 303);

  const { counts } = await settlementFor(db, bandId, event.id);
  const priorUnlocks = await db
    .select({ n: sql<number>`count(*)` })
    .from(s.eventUnlocks)
    .innerJoin(s.events, eq(s.eventUnlocks.eventId, s.events.id))
    .where(eq(s.events.bandId, bandId));
  const isFirst = Number(priorUnlocks[0]?.n ?? 0) === 0;
  const bracket = priceBracket(counts.sold - counts.comp);

  await db.insert(s.eventUnlocks).values({
    id: newId("unl"),
    eventId: event.id,
    bracket: isFirst ? "free_first" : bracket.bracket,
    amount: isFirst ? 0 : bracket.amount,
    paidAt: nowIso(),
    method: isFirst ? "free_first_event" : "pending_transfer",
    reference: null,
  });
  return c.redirect(`/admin/e/${event.slug}/dinero`, 303);
});

// ------------------------------------------------------------- event setup

/** Slug from the name, with a numeric suffix if that one is taken. */
async function uniqueSlug(db: DrizzleD1Database<typeof s>, name: string): Promise<string> {
  const base = slugify(name);
  for (let i = 0; i < 40; i++) {
    const candidate = i === 0 ? base : `${base}-${i + 1}`;
    const hit = await db
      .select({ id: s.events.id })
      .from(s.events)
      .where(eq(s.events.slug, candidate))
      .limit(1);
    if (hit.length === 0) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

type EventInput = {
  name: string; venue: string; startsAt: string; doorsAt: string | null;
  description: string | null; musicType: string | null; thankYouNote: string | null;
  capacityCap: number | null; refundPolicy: string; wristbandsStart: number | null;
  presaleAmount: number; presaleMaxQty: number | null; doorAmount: number;
};

function readEventForm(body: Record<string, unknown>): EventInput | string {
  const str = (k: string) => (typeof body[k] === "string" ? (body[k] as string).trim() : "");
  const int = (k: string) => {
    const v = str(k);
    if (!v) return null;
    const n = parseInt(v, 10);
    return Number.isFinite(n) && n >= 0 ? n : null;
  };

  const name = str("name");
  const venue = str("venue");
  if (!name) return "Falta el nombre del evento.";
  if (!venue) return "Falta el lugar.";

  const startsAt = localInputToIso(str("starts_at"));
  if (!startsAt) return "Revisá la fecha de inicio.";
  const doorsAt = str("doors_at") ? localInputToIso(str("doors_at")) : null;

  const presaleAmount = lpsToCentavos(str("presale_amount"));
  const doorAmount = lpsToCentavos(str("door_amount"));
  if (presaleAmount == null) return "Revisá el precio de preventa.";
  if (doorAmount == null) return "Revisá el precio de taquilla.";

  return {
    name, venue, startsAt, doorsAt,
    description: str("description") || null,
    musicType: str("music_type") || null,
    thankYouNote: str("thank_you") || null,
    capacityCap: int("capacity"),
    refundPolicy: str("refund_policy") === "24h" ? "24h" : "none",
    wristbandsStart: int("wristbands"),
    presaleAmount,
    presaleMaxQty: int("presale_max"),
    doorAmount,
  };
}

const REFUND_TEXT: Record<string, string | null> = {
  none: "Esta compra no admite reembolsos.",
  "24h": "Podés solicitar reembolso dentro de las 24 horas siguientes a tu compra escribiendo al correo de la banda.",
};

admin.get("/nuevo", async (c) => {
  const db = drizzle(c.env.DB, { schema: s });
  const band = await bandOf(db, c.get("bandId"));
  if (!band) return c.redirect("/admin/salir", 302);
  return c.html(<NewEventPage bandName={band.name} error={c.req.query("error") ?? undefined} />);
});

admin.post("/nuevo", async (c) => {
  const db = drizzle(c.env.DB, { schema: s });
  const bandId = c.get("bandId");
  const band = await bandOf(db, bandId);
  if (!band) return c.redirect("/admin/salir", 302);

  const parsed = readEventForm(await c.req.parseBody());
  if (typeof parsed === "string") {
    return c.html(<NewEventPage bandName={band.name} error={parsed} />, 400);
  }

  const eventId = newId("evt");
  const slug = await uniqueSlug(db, parsed.name);
  const ts = nowIso();

  // Created as a draft: /e/:slug 404s until it is published, so a half-built
  // event can never be bought from.
  await db.insert(s.events).values({
    id: eventId,
    bandId,
    name: parsed.name,
    slug,
    venue: parsed.venue,
    startsAt: parsed.startsAt,
    doorsAt: parsed.doorsAt,
    description: parsed.description,
    musicType: parsed.musicType,
    flyerUrl: null,
    thankYouNote: parsed.thankYouNote,
    capacityCap: parsed.capacityCap,
    refundPolicy: parsed.refundPolicy,
    refundPolicyText: REFUND_TEXT[parsed.refundPolicy] ?? null,
    wristbandsStart: parsed.wristbandsStart,
    staffToken: newStaffToken(),
    status: "draft",
    createdAt: ts,
  });

  // Two price rules, as the model expects: presale runs until doors (or until
  // it sells out), then box office takes over on either trigger.
  const presaleId = newId("pr");
  await db.insert(s.priceRules).values([
    {
      id: presaleId,
      eventId,
      label: "Preventa",
      amount: parsed.presaleAmount,
      maxQty: parsed.presaleMaxQty,
      startsAt: ts,
      endsAt: parsed.doorsAt ?? parsed.startsAt,
      activatesOnSelloffOf: null,
      sortOrder: 0,
    },
    {
      id: newId("pr"),
      eventId,
      label: "Taquilla",
      amount: parsed.doorAmount,
      maxQty: null,
      startsAt: parsed.doorsAt ?? parsed.startsAt,
      endsAt: null,
      activatesOnSelloffOf: presaleId,
      sortOrder: 1,
    },
  ]);

  return c.redirect(`/admin/e/${slug}/ajustes?saved=1`, 303);
});

async function eventSettingsView(
  c: Ctx,
  opts: { error?: string; saved?: boolean } = {},
) {
  const db = drizzle(c.env.DB, { schema: s });
  const bandId = c.get("bandId");
  const slug = c.req.param("slug");
  const band = await bandOf(db, bandId);
  const event = slug ? await eventOf(db, bandId, slug) : null;
  if (!band || !event) return c.notFound();

  const rules = await db
    .select()
    .from(s.priceRules)
    .where(eq(s.priceRules.eventId, event.id))
    .orderBy(s.priceRules.sortOrder);
  const [sold] = await db
    .select({ n: sql<number>`coalesce(sum(${s.orders.quantity}), 0)` })
    .from(s.orders)
    .where(and(eq(s.orders.eventId, event.id), eq(s.orders.status, "confirmed")));

  return c.html(
    <EventSettingsPage
      bandName={band.name}
      event={event}
      origin={c.env.APP_ORIGIN}
      soldCount={Number(sold?.n ?? 0)}
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
      }}
    />,
  );
}

admin.get("/e/:slug/ajustes", (c) =>
  eventSettingsView(c, { saved: c.req.query("saved") === "1" }),
);

admin.post("/e/:slug/ajustes", async (c) => {
  const db = drizzle(c.env.DB, { schema: s });
  const bandId = c.get("bandId");
  const event = await eventOf(db, bandId, c.req.param("slug"));
  if (!event) return c.notFound();

  const parsed = readEventForm(await c.req.parseBody());
  if (typeof parsed === "string") return eventSettingsView(c, { error: parsed });

  await db
    .update(s.events)
    .set({
      name: parsed.name,
      venue: parsed.venue,
      startsAt: parsed.startsAt,
      doorsAt: parsed.doorsAt,
      description: parsed.description,
      musicType: parsed.musicType,
      thankYouNote: parsed.thankYouNote,
      capacityCap: parsed.capacityCap,
      refundPolicy: parsed.refundPolicy,
      refundPolicyText: REFUND_TEXT[parsed.refundPolicy] ?? null,
      wristbandsStart: parsed.wristbandsStart,
    })
    .where(eq(s.events.id, event.id));

  // Price changes affect new orders only — every existing order stores the
  // amount it was quoted, so nobody's past purchase silently reprices.
  const rules = await db
    .select()
    .from(s.priceRules)
    .where(eq(s.priceRules.eventId, event.id))
    .orderBy(s.priceRules.sortOrder);
  if (rules[0]) {
    await db
      .update(s.priceRules)
      .set({
        amount: parsed.presaleAmount,
        maxQty: parsed.presaleMaxQty,
        endsAt: parsed.doorsAt ?? parsed.startsAt,
      })
      .where(eq(s.priceRules.id, rules[0].id));
  }
  if (rules[1]) {
    await db
      .update(s.priceRules)
      .set({ amount: parsed.doorAmount, startsAt: parsed.doorsAt ?? parsed.startsAt })
      .where(eq(s.priceRules.id, rules[1].id));
  }

  return c.redirect(`/admin/e/${event.slug}/ajustes?saved=1`, 303);
});

admin.post("/e/:slug/ajustes/estado", async (c) => {
  const db = drizzle(c.env.DB, { schema: s });
  const bandId = c.get("bandId");
  const event = await eventOf(db, bandId, c.req.param("slug"));
  if (!event) return c.notFound();

  const body = await c.req.parseBody();
  const wanted = String(body["status"] ?? "");
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
      return eventSettingsView(c, {
        error: "Agregá al menos una cuenta bancaria antes de publicar — si no, el comprador no tiene a dónde transferir.",
      });
    }
  }

  await db.update(s.events).set({ status }).where(eq(s.events.id, event.id));
  return c.redirect(`/admin/e/${event.slug}/ajustes?saved=1`, 303);
});

admin.post("/e/:slug/ajustes/token", async (c) => {
  const db = drizzle(c.env.DB, { schema: s });
  const event = await eventOf(db, c.get("bandId"), c.req.param("slug"));
  if (!event) return c.notFound();
  // Regenerating invalidates the old link immediately — that is the point when
  // a staff member leaves or a link gets shared too widely.
  await db.update(s.events).set({ staffToken: newStaffToken() }).where(eq(s.events.id, event.id));
  return c.redirect(`/admin/e/${event.slug}/ajustes?saved=1`, 303);
});

// -------------------------------------------------------------- band setup

async function bandSettingsView(
  c: Ctx,
  opts: { error?: string; saved?: boolean } = {},
) {
  const db = drizzle(c.env.DB, { schema: s });
  const bandId = c.get("bandId");
  const band = await bandOf(db, bandId);
  if (!band) return c.redirect("/admin/salir", 302);

  const [accounts, members, evs] = await Promise.all([
    db.select().from(s.bankAccounts).where(eq(s.bankAccounts.bandId, bandId)).orderBy(s.bankAccounts.sortOrder),
    db.select().from(s.bandMembers).where(eq(s.bandMembers.bandId, bandId)).orderBy(s.bandMembers.sortOrder),
    db.select().from(s.events).where(eq(s.events.bandId, bandId)).orderBy(desc(s.events.startsAt)),
  ]);

  const advRows = await db
    .select({ adv: s.advances, member: s.bandMembers })
    .from(s.advances)
    .innerJoin(s.bandMembers, eq(s.advances.memberId, s.bandMembers.id))
    .where(eq(s.advances.bandId, bandId))
    .orderBy(desc(s.advances.date));
  const eventName = new Map(evs.map((e) => [e.id, e.name]));

  return c.html(
    <BandSettingsPage
      band={band}
      accounts={accounts}
      members={members}
      events={evs}
      advances={advRows.map((r) => ({
        id: r.adv.id,
        memberName: r.member.name,
        amount: r.adv.amount,
        date: r.adv.date,
        eventName: r.adv.eventId ? (eventName.get(r.adv.eventId) ?? null) : null,
      }))}
      error={opts.error}
      saved={opts.saved}
    />,
  );
}

admin.get("/banda", (c) => bandSettingsView(c, { saved: c.req.query("saved") === "1" }));

admin.post("/banda", async (c) => {
  const db = drizzle(c.env.DB, { schema: s });
  const body = await c.req.parseBody();
  const name = String(body["name"] ?? "").trim();
  const email = normalizeEmail(String(body["contact_email"] ?? ""));
  if (!name) return bandSettingsView(c, { error: "Falta el nombre de la banda." });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return bandSettingsView(c, { error: "Revisá el correo." });
  }
  await db
    .update(s.bands)
    .set({ name, contactEmail: email })
    .where(eq(s.bands.id, c.get("bandId")));
  return c.redirect("/admin/banda?saved=1", 303);
});

admin.post("/banda/cuenta", async (c) => {
  const db = drizzle(c.env.DB, { schema: s });
  const bandId = c.get("bandId");
  const body = await c.req.parseBody();
  const accountNumber = String(body["account_number"] ?? "").replace(/\s/g, "");
  const holderName = String(body["holder_name"] ?? "").trim();
  const bank = String(body["bank"] ?? "BAC");
  if (!accountNumber || !holderName) {
    return bandSettingsView(c, { error: "Falta el número de cuenta o el titular." });
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
  return c.redirect("/admin/banda?saved=1", 303);
});

admin.post("/banda/cuenta/borrar", async (c) => {
  const db = drizzle(c.env.DB, { schema: s });
  const bandId = c.get("bandId");
  const id = String((await c.req.parseBody())["id"] ?? "");
  await db
    .delete(s.bankAccounts)
    .where(and(eq(s.bankAccounts.id, id), eq(s.bankAccounts.bandId, bandId)));

  // Never leave the band without a default, or "Otro" has nothing to show.
  const left = await db
    .select()
    .from(s.bankAccounts)
    .where(eq(s.bankAccounts.bandId, bandId))
    .orderBy(s.bankAccounts.sortOrder);
  if (left.length > 0 && !left.some((a) => a.isDefault === 1)) {
    await db
      .update(s.bankAccounts)
      .set({ isDefault: 1 })
      .where(eq(s.bankAccounts.id, left[0]!.id));
  }
  return c.redirect("/admin/banda?saved=1", 303);
});

admin.post("/banda/integrante", async (c) => {
  const db = drizzle(c.env.DB, { schema: s });
  const bandId = c.get("bandId");
  const body = await c.req.parseBody();
  const id = String(body["id"] ?? "");
  const name = String(body["name"] ?? "").trim();
  const pct = Number(body["split_pct"]);
  if (!name || !Number.isFinite(pct) || pct < 0 || pct > 100) {
    return bandSettingsView(c, { error: "Revisá el nombre y el porcentaje (0 a 100)." });
  }

  if (id) {
    await db
      .update(s.bandMembers)
      .set({ name, splitPct: pct })
      .where(and(eq(s.bandMembers.id, id), eq(s.bandMembers.bandId, bandId)));
  } else {
    const existing = await db
      .select({ id: s.bandMembers.id })
      .from(s.bandMembers)
      .where(eq(s.bandMembers.bandId, bandId));
    await db.insert(s.bandMembers).values({
      id: newId("mem"),
      bandId,
      name,
      splitPct: pct,
      isCore: 1,
      sortOrder: existing.length,
    });
  }
  return c.redirect("/admin/banda?saved=1", 303);
});

admin.post("/banda/integrante/borrar", async (c) => {
  const db = drizzle(c.env.DB, { schema: s });
  const id = String((await c.req.parseBody())["id"] ?? "");
  await db
    .delete(s.bandMembers)
    .where(and(eq(s.bandMembers.id, id), eq(s.bandMembers.bandId, c.get("bandId"))));
  return c.redirect("/admin/banda?saved=1", 303);
});

admin.post("/banda/adelanto", async (c) => {
  const db = drizzle(c.env.DB, { schema: s });
  const bandId = c.get("bandId");
  const body = await c.req.parseBody();
  const memberId = String(body["member_id"] ?? "");
  const eventId = String(body["event_id"] ?? "") || null;
  const amount = lpsToCentavos(String(body["amount"] ?? ""));
  if (!memberId || amount == null || amount === 0) {
    return bandSettingsView(c, { error: "Revisá el integrante y el monto." });
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
  return c.redirect("/admin/banda?saved=1", 303);
});

admin.post("/banda/adelanto/borrar", async (c) => {
  const db = drizzle(c.env.DB, { schema: s });
  const id = String((await c.req.parseBody())["id"] ?? "");
  await db
    .delete(s.advances)
    .where(and(eq(s.advances.id, id), eq(s.advances.bandId, c.get("bandId"))));
  return c.redirect("/admin/banda?saved=1", 303);
});

/**
 * Decide a refund. Approving marks the order `refunded`, which drops it from
 * every total and stops its QR codes scanning, because each aggregate and the
 * scanner manifest filter on status = 'confirmed'. The money itself moves in
 * the band's banking app — Coverr never held it.
 */
admin.post("/e/:slug/orden/:id/reembolso", async (c) => {
  const db = drizzle(c.env.DB, { schema: s });
  const bandId = c.get("bandId");
  const event = await eventOf(db, bandId, c.req.param("slug"));
  if (!event) return c.notFound();

  const orderId = c.req.param("id");
  const decision = String((await c.req.parseBody())["decision"] ?? "");
  if (decision !== "approved" && decision !== "denied") {
    return c.redirect(`/admin/e/${event.slug}/orden/${orderId}`, 303);
  }

  const ts = nowIso();
  await db
    .update(s.refundRequests)
    .set({ status: decision, handledBy: bandId, handledAt: ts })
    .where(and(eq(s.refundRequests.orderId, orderId), eq(s.refundRequests.status, "open")));

  if (decision === "approved") {
    await db
      .update(s.orders)
      .set({ status: "refunded" })
      .where(and(eq(s.orders.id, orderId), eq(s.orders.eventId, event.id)));
  }
  return c.redirect(`/admin/e/${event.slug}/orden/${orderId}`, 303);
});

// --------------------------------------------------------------- manual sale

async function manualSaleView(c: Ctx, opts: { error?: string; created?: any } = {}) {
  const db = drizzle(c.env.DB, { schema: s });
  const slug = c.req.param("slug");
  const band = await bandOf(db, c.get("bandId"));
  const event = slug ? await eventOf(db, c.get("bandId"), slug) : null;
  if (!band || !event) return c.notFound();

  const rule = await resolveActiveRuleFor(db, event.id);
  return c.html(
    <ManualSalePage
      bandName={band.name}
      event={event}
      defaultPrice={rule?.amount ?? 0}
      priceLabel={rule?.label ?? "Taquilla"}
      created={opts.created ?? null}
      error={opts.error}
    />,
  );
}

/** Whichever price rule is live now, so the form opens with the sensible default. */
async function resolveActiveRuleFor(db: DrizzleD1Database<typeof s>, eventId: string) {
  const rules = await db
    .select()
    .from(s.priceRules)
    .where(eq(s.priceRules.eventId, eventId))
    .orderBy(s.priceRules.sortOrder);
  const now = new Date();
  for (const r of rules) {
    const started = !r.startsAt || new Date(r.startsAt) <= now;
    const ended = r.endsAt != null && new Date(r.endsAt) <= now;
    if (started && !ended) return r;
  }
  return rules[rules.length - 1] ?? null;
}

admin.get("/e/:slug/venta", (c) => manualSaleView(c));

admin.post("/e/:slug/venta", async (c) => {
  const db = drizzle(c.env.DB, { schema: s });
  const bandId = c.get("bandId");
  const band = await bandOf(db, bandId);
  const event = await eventOf(db, bandId, c.req.param("slug"));
  if (!band || !event) return c.notFound();

  const body = await c.req.parseBody();
  const str = (k: string) => (typeof body[k] === "string" ? (body[k] as string).trim() : "");

  const names = str("names")
    .split("\n")
    .map((n) => n.trim())
    .filter(Boolean)
    .slice(0, 40);
  if (names.length === 0) return manualSaleView(c, { error: "Poné al menos un nombre." });

  const unit = lpsToCentavos(str("unit_price"));
  if (unit == null) return manualSaleView(c, { error: "Revisá el monto." });

  const note = str("note");
  if (!note) return manualSaleView(c, { error: "Escribí por qué — sin eso la orden no se explica después." });

  const payerEmail = str("payer_email");
  if (payerEmail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(payerEmail)) {
    return manualSaleView(c, { error: "Revisá el correo." });
  }

  const ts = nowIso();
  const orderId = newId("ord");
  const quantity = names.length;

  // Zero-value goes in as a comp so it counts as attendance and never as
  // revenue; anything paid is its own `manual` channel, kept separate from the
  // door take so the cash drawer still reconciles on the night.
  const channel = unit === 0 ? "comp" : "manual";

  await db.insert(s.orders).values({
    id: orderId,
    eventId: event.id,
    shortCode: newShortCode(band.slug),
    payerName: str("payer_name") || names[0]!,
    payerEmail: payerEmail || `manual+${orderId}@local`,
    payerPhone: null,
    quantity,
    priceRuleId: null,
    expectedAmount: unit * quantity,
    channel,
    status: "confirmed",
    verificationStatus: "manual_ok",
    bankSelected: null,
    soldBy: bandId,
    note,
    createdAt: ts,
  });

  // Never checked in: nobody is at the door yet, so these scan like any other.
  await db.insert(s.attendees).values(
    names.map((name) => ({
      id: newId("att"),
      orderId,
      name,
      note,
      qrToken: newQrToken(),
      checkedInAt: null,
      checkedInBy: null,
      checkedInDevice: null,
    })),
  );

  if (payerEmail) c.executionCtx.waitUntil(sendTickets(c.env, orderId));

  return manualSaleView(c, {
    created: { shortCode: "", quantity, amount: unit * quantity, orderId },
  });
});
