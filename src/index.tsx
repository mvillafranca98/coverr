import { Hono } from "hono";
import { drizzle, type DrizzleD1Database } from "drizzle-orm/d1";
import { eq, and, sql } from "drizzle-orm";
import * as s from "./db/schema";
import { BuyPage } from "./views/buy";
import { ConfirmPage } from "./views/confirm";
import { RecoverPage } from "./views/recover";
import { qrSvg, qrPng } from "./lib/qr";
import { makeTransport } from "./lib/email";
import { ticketEmailHtml, ticketEmailText, ticketEmailSubject } from "./views/email";
import {
  newId,
  newQrToken,
  newShortCode,
  nowIso,
  purgeAfter,
  sha256Hex,
  normalizeEmail,
  normalizePhone,
} from "./lib/core";

type Bindings = {
  DB: D1Database;
  PROOFS: R2Bucket;
  ASSETS: Fetcher;
  APP_ORIGIN: string;
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
};

const app = new Hono<{ Bindings: Bindings }>();

const MAX_PROOF_BYTES = 10 * 1024 * 1024;
const MAX_TICKETS = 10;

/**
 * Which price applies right now. Presale runs until its window closes or it
 * sells out; box office takes over on its own start time or on presale
 * selloff, whichever comes first. Never trust the rule id the client submits —
 * it is re-resolved server-side at purchase.
 */
async function resolveActiveRule(db: DrizzleD1Database<typeof s>, eventId: string) {
  const rules = await db
    .select()
    .from(s.priceRules)
    .where(eq(s.priceRules.eventId, eventId))
    .orderBy(s.priceRules.sortOrder);
  if (rules.length === 0) return null;

  const now = new Date();
  const soldByRule = new Map<string, number>();
  const counts = await db
    .select({
      ruleId: s.orders.priceRuleId,
      qty: sql<number>`coalesce(sum(${s.orders.quantity}), 0)`,
    })
    .from(s.orders)
    .where(and(eq(s.orders.eventId, eventId), eq(s.orders.status, "confirmed")))
    .groupBy(s.orders.priceRuleId);
  for (const c of counts) if (c.ruleId) soldByRule.set(c.ruleId, Number(c.qty));

  const isSoldOut = (r: (typeof rules)[number]) =>
    r.maxQty != null && (soldByRule.get(r.id) ?? 0) >= r.maxQty;

  for (const r of rules) {
    const started = !r.startsAt || new Date(r.startsAt) <= now;
    const ended = r.endsAt != null && new Date(r.endsAt) <= now;
    const predecessorSoldOut = r.activatesOnSelloffOf
      ? isSoldOut(rules.find((x) => x.id === r.activatesOnSelloffOf) ?? r)
      : false;

    if (isSoldOut(r) || ended) continue;
    if (started || predecessorSoldOut) return r;
  }
  return null;
}

async function loadEvent(db: DrizzleD1Database<typeof s>, slug: string) {
  const rows = await db
    .select({ event: s.events, band: s.bands })
    .from(s.events)
    .innerJoin(s.bands, eq(s.events.bandId, s.bands.id))
    .where(eq(s.events.slug, slug))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Sends one order's tickets. Never throws into the request path: a mail failure
 * must not cost the buyer their confirmation page, since they have already
 * paid by the time we get here. Failures are logged for the admin to chase.
 */
async function sendTickets(env: Bindings, orderId: string): Promise<boolean> {
  const db = drizzle(env.DB, { schema: s });
  const rows = await db
    .select({ order: s.orders, event: s.events, band: s.bands })
    .from(s.orders)
    .innerJoin(s.events, eq(s.orders.eventId, s.events.id))
    .innerJoin(s.bands, eq(s.events.bandId, s.bands.id))
    .where(eq(s.orders.id, orderId))
    .limit(1);
  const row = rows[0];
  if (!row || row.order.status !== "confirmed") return false;

  const atts = await db.select().from(s.attendees).where(eq(s.attendees.orderId, orderId));
  if (atts.length === 0) return false;

  const input = {
    band: row.band,
    event: row.event,
    order: row.order,
    attendees: atts,
    origin: env.APP_ORIGIN,
  };

  const result = await makeTransport(env).send({
    to: row.order.payerEmail,
    subject: ticketEmailSubject(input),
    html: ticketEmailHtml(input),
    text: ticketEmailText(input),
    replyTo: row.band.contactEmail,
  });

  if (!result.ok) {
    console.error(`[tickets] send failed order=${row.order.shortCode} ${result.error}`);
    return false;
  }
  console.log(`[tickets] sent order=${row.order.shortCode} to=${row.order.payerEmail}`);
  return true;
}

// ---------------------------------------------------------------- buyer page

app.get("/e/:slug", async (c) => {
  const db = drizzle(c.env.DB, { schema: s });
  const found = await loadEvent(db, c.req.param("slug"));
  if (!found) return c.notFound();
  const { event, band } = found;

  if (event.status !== "live") {
    return c.html(
      `<!doctype html><meta charset=utf-8><body style="font-family:system-ui;background:#0C0B09;color:#F6F2EB;padding:40px;text-align:center">
       <h1>Esta venta no está abierta</h1><p style="color:#A79E90">Escribinos si creés que es un error.</p></body>`,
      404,
    );
  }

  const rule = await resolveActiveRule(db, event.id);
  if (!rule) {
    return c.html(
      `<!doctype html><meta charset=utf-8><body style="font-family:system-ui;background:#0C0B09;color:#F6F2EB;padding:40px;text-align:center">
       <h1>Boletos agotados</h1><p style="color:#A79E90">Ya no hay boletos disponibles en línea.</p></body>`,
      410,
    );
  }

  const accounts = await db
    .select()
    .from(s.bankAccounts)
    .where(and(eq(s.bankAccounts.bandId, band.id), eq(s.bankAccounts.active, 1)))
    .orderBy(s.bankAccounts.sortOrder);
  if (accounts.length === 0) return c.text("Este evento no tiene cuenta bancaria configurada.", 500);

  return c.html(
    <BuyPage
      band={band}
      event={event}
      rule={rule}
      accounts={accounts}
      shortCode={newShortCode(band.slug)}
      origin={c.env.APP_ORIGIN}
      error={c.req.query("error") ?? undefined}
    />,
  );
});

// ------------------------------------------------------------------ purchase

app.post("/e/:slug/comprar", async (c) => {
  const slug = c.req.param("slug");
  const db = drizzle(c.env.DB, { schema: s });
  const found = await loadEvent(db, slug);
  if (!found) return c.notFound();
  const { event, band } = found;

  const fail = (msg: string) =>
    c.redirect(`/e/${slug}?error=${encodeURIComponent(msg)}`, 303);

  const body = await c.req.parseBody();
  const str = (k: string) => (typeof body[k] === "string" ? (body[k] as string).trim() : "");

  const quantity = Math.min(MAX_TICKETS, Math.max(1, parseInt(str("quantity"), 10) || 1));
  const payerName = str("payer_name");
  const payerEmail = str("payer_email");
  const payerPhone = str("payer_phone") || null;
  const bankSelected = str("bank") || null;

  if (!payerName) return fail("Falta tu nombre.");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(payerEmail)) return fail("Revisá tu correo electrónico.");
  if (body["consent"] !== "1") return fail("Tenés que aceptar los términos para continuar.");

  const attendeeInput: { name: string; note: string | null }[] = [];
  for (let i = 1; i <= quantity; i++) {
    const name = str(`attendee_name_${i}`);
    if (!name) return fail(`Falta el nombre de la persona ${i}.`);
    attendeeInput.push({ name, note: str(`attendee_note_${i}`) || null });
  }

  const proof = body["proof"];
  if (!(proof instanceof File) || proof.size === 0) return fail("Subí tu comprobante de pago.");
  if (proof.size > MAX_PROOF_BYTES) return fail("El archivo es muy grande (máximo 10 MB).");

  // Re-resolve the price server-side. The client tells us nothing about money.
  const rule = await resolveActiveRule(db, event.id);
  if (!rule) return fail("Ya no hay boletos disponibles.");
  const expectedAmount = rule.amount * quantity;

  if (event.capacityCap != null) {
    const [sold] = await db
      .select({ n: sql<number>`coalesce(sum(${s.orders.quantity}), 0)` })
      .from(s.orders)
      .where(and(eq(s.orders.eventId, event.id), eq(s.orders.status, "confirmed")));
    if (Number(sold?.n ?? 0) + quantity > event.capacityCap) return fail("Ya no hay cupo suficiente.");
  }

  const bytes = await proof.arrayBuffer();
  const sha256 = await sha256Hex(bytes);

  const orderId = newId("ord");
  const ts = nowIso();
  const fileKey = `proofs/${event.id}/${orderId}`;

  await c.env.PROOFS.put(fileKey, bytes, {
    httpMetadata: { contentType: proof.type || "application/octet-stream" },
    customMetadata: { orderId, eventId: event.id, sha256 },
  });

  // The buyer-facing code they may have pasted into "Detalle". If it collides
  // we regenerate — Detalle is a matching hint, never authoritative, so a rare
  // mismatch degrades to name + amount + reference matching.
  let shortCode = str("short_code") || newShortCode(band.slug);
  for (let attempt = 0; attempt < 5; attempt++) {
    const clash = await db
      .select({ id: s.orders.id })
      .from(s.orders)
      .where(eq(s.orders.shortCode, shortCode))
      .limit(1);
    if (clash.length === 0) break;
    shortCode = newShortCode(band.slug);
  }

  const attendeeRows = attendeeInput.map((a) => ({
    id: newId("att"),
    orderId,
    name: a.name,
    note: a.note,
    qrToken: newQrToken(),
    checkedInAt: null,
    checkedInBy: null,
    checkedInDevice: null,
  }));

  const proofId = newId("prf");

  await db.insert(s.orders).values({
    id: orderId,
    eventId: event.id,
    shortCode,
    payerName,
    payerEmail: normalizeEmail(payerEmail),
    payerPhone: normalizePhone(payerPhone),
    quantity,
    priceRuleId: rule.id,
    expectedAmount,
    channel: "online",
    status: "confirmed",
    verificationStatus: "unmatched",
    bankSelected,
    soldBy: null,
    createdAt: ts,
  });
  await db.insert(s.attendees).values(attendeeRows);
  await db.insert(s.paymentProofs).values({
    id: proofId,
    orderId,
    fileKey,
    contentType: proof.type || "application/octet-stream",
    fileSize: proof.size,
    sha256,
    phash: null,
    docType: "unknown",
    ocrRaw: null,
    ocrConfidence: null,
    xSenderName: null,
    xSenderAccount: null,
    xDestAccount: null,
    xDestName: null,
    xAmount: null,
    xCurrency: null,
    xDatetime: null,
    xReference: null,
    xDetail: null,
    xBank: null,
    uploadedAt: ts,
    purgeAfter: purgeAfter(event.startsAt),
  });

  // Deterministic checks that need no OCR. The QR is never withheld — a flag is
  // internal bookkeeping the admin sees and the door scanner surfaces as amber.
  const dupes = await db
    .select({ id: s.paymentProofs.id, orderId: s.paymentProofs.orderId })
    .from(s.paymentProofs)
    .where(and(eq(s.paymentProofs.sha256, sha256), sql`${s.paymentProofs.orderId} != ${orderId}`))
    .limit(1);

  if (dupes.length > 0) {
    const prior = await db
      .select({ shortCode: s.orders.shortCode })
      .from(s.orders)
      .where(eq(s.orders.id, dupes[0]!.orderId))
      .limit(1);
    await db.insert(s.verificationFlags).values({
      id: newId("flg"),
      orderId,
      proofId,
      code: "HASH_DUPLICATE",
      severity: "critical",
      detail: `Ese comprobante ya lo recibimos en la orden ${prior[0]?.shortCode ?? "anterior"}`,
      createdAt: ts,
      resolvedAt: null,
      resolvedBy: null,
      resolutionNote: null,
    });
    await db
      .update(s.orders)
      .set({ verificationStatus: "flagged" })
      .where(eq(s.orders.id, orderId));
  }

  // The buyer sees their QR codes on the next screen regardless — email is the
  // backup copy, so it must never delay or block the confirmation.
  c.executionCtx.waitUntil(sendTickets(c.env, orderId));

  return c.redirect(`/boletos/${orderId}`, 303);
});

// -------------------------------------------------------------- confirmation

app.get("/boletos/:orderId", async (c) => {
  const db = drizzle(c.env.DB, { schema: s });
  const rows = await db
    .select({ order: s.orders, event: s.events, band: s.bands })
    .from(s.orders)
    .innerJoin(s.events, eq(s.orders.eventId, s.events.id))
    .innerJoin(s.bands, eq(s.events.bandId, s.bands.id))
    .where(eq(s.orders.id, c.req.param("orderId")))
    .limit(1);
  const row = rows[0];
  if (!row || row.order.status === "void") return c.notFound();

  const atts = await db
    .select()
    .from(s.attendees)
    .where(eq(s.attendees.orderId, row.order.id));

  return c.html(
    <ConfirmPage band={row.band} event={row.event} order={row.order} attendees={atts} />,
  );
});

// -------------------------------------------------------------- QR as a file

app.get("/t/:token{.+\\.svg}", async (c) => {
  const token = c.req.param("token").replace(/\.svg$/, "");
  const db = drizzle(c.env.DB, { schema: s });
  const hit = await db
    .select({ id: s.attendees.id })
    .from(s.attendees)
    .where(eq(s.attendees.qrToken, token))
    .limit(1);
  if (hit.length === 0) return c.notFound();

  return c.body(qrSvg(token, { size: 640 }), 200, {
    "Content-Type": "image/svg+xml; charset=utf-8",
    "Cache-Control": "private, max-age=31536000, immutable",
  });
});

app.get("/t/:token{.+\\.png}", async (c) => {
  const token = c.req.param("token").replace(/\.png$/, "");
  const db = drizzle(c.env.DB, { schema: s });
  const hit = await db
    .select({ id: s.attendees.id })
    .from(s.attendees)
    .where(eq(s.attendees.qrToken, token))
    .limit(1);
  if (hit.length === 0) return c.notFound();

  const png = await qrPng(token, 8);
  return c.body(png, 200, {
    "Content-Type": "image/png",
    "Cache-Control": "public, max-age=31536000, immutable",
  });
});

// ------------------------------------------------------------------ recovery

app.get("/recuperar", (c) => c.html(<RecoverPage sent={c.req.query("ok") === "1"} />));

app.post("/recuperar", async (c) => {
  const body = await c.req.parseBody();
  const email = typeof body["email"] === "string" ? normalizeEmail(body["email"]) : "";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return c.html(<RecoverPage error="Revisá el correo que escribiste." />, 400);
  }

  const db = drizzle(c.env.DB, { schema: s });
  const found = await db
    .select({ id: s.orders.id })
    .from(s.orders)
    .innerJoin(s.events, eq(s.orders.eventId, s.events.id))
    .where(and(eq(s.orders.payerEmail, email), eq(s.orders.status, "confirmed")));

  // Resend every live order on that address, then answer identically whether or
  // not anything matched.
  c.executionCtx.waitUntil(
    (async () => {
      for (const o of found) await sendTickets(c.env, o.id);
    })(),
  );

  return c.redirect("/recuperar?ok=1", 303);
});

app.get("/", (c) =>
  c.html(
    `<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1">
     <body style="font-family:system-ui;background:#0C0B09;color:#F6F2EB;padding:48px 24px;text-align:center">
     <h1 style="letter-spacing:-.02em">Coverr</h1>
     <p style="color:#A79E90">Preventa, entrada y cuentas claras para bandas.</p></body>`,
  ),
);

app.notFound((c) =>
  c.html(
    `<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1">
     <body style="font-family:system-ui;background:#0C0B09;color:#F6F2EB;padding:48px 24px;text-align:center">
     <h1>No encontramos esta página</h1>
     <p style="color:#A79E90">Revisá el enlace que te compartieron.</p></body>`,
    404,
  ),
);

app.onError((err, c) => {
  console.error("unhandled", err);
  return c.html(
    `<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1">
     <body style="font-family:system-ui;background:#0C0B09;color:#F6F2EB;padding:48px 24px;text-align:center">
     <h1>Algo salió mal</h1>
     <p style="color:#A79E90">Volvé a intentarlo. Si ya transferiste, escribinos y lo resolvemos.</p></body>`,
    500,
  );
});

export default app;
