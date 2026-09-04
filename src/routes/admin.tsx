import { Hono } from "hono";
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
import { eventMetrics, costsByCategory, fanStats } from "../lib/stats";
import { computeSettlement, priceBracket } from "../lib/settlement";
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
import { newId, nowIso, normalizeEmail, escapeHtml } from "../lib/core";
import { runVerification } from "../lib/pipeline";

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
    comp: Number(by("comp")?.people ?? 0),
    sold: 0,
    inside: 0,
  };
  counts.sold = counts.presale + counts.doorOnline + counts.doorCash + counts.comp;

  const channels = {
    presale: Number(by("online")?.amount ?? 0),
    doorTransfer: Number(by("door_online")?.amount ?? 0),
    doorCash: Number(by("door_cash")?.amount ?? 0),
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
  const played = events.filter((e) => e.attendance > 0);
  const [categories, fans] = await Promise.all([
    costsByCategory(c.env.DB, band.id),
    fanStats(c.env.DB, band.id, played[0]?.id ?? null),
  ]);

  return c.html(
    <BandHomePage bandName={band.name} events={events} categories={categories} fans={fans} />,
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

  return c.html(
    <DashboardPage
      bandName={band.name}
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
    case "online":
    case "door_cash":
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
    ["codigo", "comprador", "correo", "telefono", "asistentes", "cantidad", "adentro", "canal", "monto_lps", "estado", "banco", "fecha", "alerta"]
      .map(esc)
      .join(","),
    ...rows.map((r) =>
      [
        r.shortCode, r.payerName, r.payerEmail, r.payerPhone ?? "", r.attendees,
        r.quantity, r.checkedIn, r.channel, (r.expectedAmount / 100).toFixed(2),
        r.status, r.bankSelected ?? "", r.createdAt, r.flag ?? "",
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

  return c.html(
    <OrderPage
      bandName={band.name}
      event={event}
      order={order}
      attendees={attendees}
      proof={proofs[0] ?? null}
      flags={flags}
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
      unlocked={!!unlock[0]}
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
