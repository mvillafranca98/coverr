import { Hono } from "hono";
import { drizzle, type DrizzleD1Database } from "drizzle-orm/d1";
import { eq, and, sql } from "drizzle-orm";
import * as s from "./db/schema";
import { BuyPage } from "./views/buy";
import { ConfirmPage } from "./views/confirm";
import { RecoverPage } from "./views/recover";
import { RefundRequestPage, RefundSentPage, RefundClosedPage } from "./views/refund";
import { SignupPage, SignupSentPage } from "./views/signup";
import { scanApi } from "./routes/scan";
import { admin } from "./routes/admin";
import { LandingPage } from "./views/home";
import { qrSvg, qrPng } from "./lib/qr";
import { makeTransport } from "./lib/email";
import { sendTickets } from "./lib/tickets";
import { sign, LOGIN_TTL } from "./lib/auth";
import { runVerification } from "./lib/pipeline";
import {
  formatLpsShort,
  escapeHtml,
  slugify,
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
  SESSION_SECRET?: string;
  ANTHROPIC_API_KEY?: string;
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
  // Reads the proof and raises flags. Runs after the response for the same
  // reason mail does: the buyer already has their QR codes and nothing here
  // can take them away.
  c.executionCtx.waitUntil(runVerification(c.env, orderId));

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


// -------------------------------------------------------------- door scanner

app.route("/api/scan", scanApi);

// --------------------------------------------------------------- band signup

/**
 * Creating a band is the one flow a new user hits before they have anything,
 * so it asks for two fields and nothing else.
 *
 * An email that already belongs to a band does not error and does not say so —
 * it just sends that band a login link. Same response either way, so the page
 * cannot be used to discover which addresses run a band.
 */
app.get("/registro", (c) => c.html(<SignupPage />));

app.post("/registro", async (c) => {
  const db = drizzle(c.env.DB, { schema: s });
  const body = await c.req.parseBody();
  const name = String(body["name"] ?? "").trim().slice(0, 80);
  const email = normalizeEmail(String(body["email"] ?? ""));

  if (!name) return c.html(<SignupPage error="Falta el nombre de la banda." email={email} />, 400);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return c.html(<SignupPage error="Revisá el correo." name={name} />, 400);
  }
  if (!c.env.SESSION_SECRET) return c.text("SESSION_SECRET no está configurado.", 500);

  const existing = await db
    .select()
    .from(s.bands)
    .where(eq(s.bands.contactEmail, email))
    .limit(1);

  let bandId: string;
  let bandName: string;
  if (existing[0]) {
    bandId = existing[0].id;
    bandName = existing[0].name;
  } else {
    bandId = newId("bnd");
    bandName = name;
    let slug = slugify(name);
    for (let i = 0; i < 40; i++) {
      const candidate = i === 0 ? slug : `${slug}-${i + 1}`;
      const clash = await db
        .select({ id: s.bands.id })
        .from(s.bands)
        .where(eq(s.bands.slug, candidate))
        .limit(1);
      if (clash.length === 0) {
        slug = candidate;
        break;
      }
    }
    await db.insert(s.bands).values({
      id: bandId,
      name,
      slug,
      contactEmail: email,
      createdAt: nowIso(),
    });
  }

  const token = await sign(c.env.SESSION_SECRET, { b: bandId }, LOGIN_TTL);
  const url = `${c.env.APP_ORIGIN}/admin/entrar?t=${encodeURIComponent(token)}`;
  c.executionCtx.waitUntil(
    makeTransport(c.env)
      .send({
        to: email,
        subject: `Entrar a Coverr — ${bandName}`,
        html: `<!doctype html><html lang="es"><body style="margin:0;background:#f3f1ea;padding:28px 14px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif">
<table role="presentation" width="100%"><tr><td align="center"><table role="presentation" width="100%" style="max-width:440px;text-align:left">
<tr><td style="font:600 11px/1 ui-monospace,Menlo,monospace;letter-spacing:.2em;text-transform:uppercase;color:#b0651a;padding-bottom:10px">Coverr</td></tr>
<tr><td style="font:700 22px/1.2 inherit;color:#191713;padding-bottom:10px">Entrar al panel de ${escapeHtml(bandName)}</td></tr>
<tr><td style="font:400 15px/1.5 inherit;color:#57534b;padding-bottom:20px">Tocá el botón para entrar. El enlace vence en 15 minutos.</td></tr>
<tr><td><a href="${url}" style="display:inline-block;padding:13px 22px;border-radius:9px;background:#191713;color:#fff;font:600 15px/1 inherit;text-decoration:none">Entrar</a></td></tr>
<tr><td style="font:400 12px/1.6 inherit;color:#8a857b;padding-top:22px">Si no pediste esto, ignoralo — nadie puede entrar sin este correo.</td></tr>
</table></td></tr></table></body></html>`,
        text: `Entrar al panel de ${bandName}:\n\n${url}\n\nEl enlace vence en 15 minutos.`,
      })
      .then((r) => {
        if (!r.ok) console.error(`[signup] link failed for ${email}: ${r.error}`);
      }),
  );

  return c.html(<SignupSentPage email={email} />);
});

// -------------------------------------------------------------- refunds

const REFUND_WINDOW_MS = 24 * 60 * 60 * 1000;

async function loadForRefund(db: DrizzleD1Database<typeof s>, orderId: string) {
  const rows = await db
    .select({ order: s.orders, event: s.events, band: s.bands })
    .from(s.orders)
    .innerJoin(s.events, eq(s.orders.eventId, s.events.id))
    .innerJoin(s.bands, eq(s.events.bandId, s.bands.id))
    .where(eq(s.orders.id, orderId))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Decides whether a refund can still be asked for. The policy shown at checkout
 * is stored on the order, so changing the band's policy later never retroactively
 * closes a window someone already bought under.
 */
function refundGate(
  order: { status: string; createdAt: string; channel: string },
  policy: string,
): { open: true } | { open: false; headline: string; detail: string } {
  if (order.status === "refunded") {
    return { open: false, headline: "Ya está reembolsado", detail: "Esta orden ya fue devuelta." };
  }
  if (order.status === "void") {
    return { open: false, headline: "Orden anulada", detail: "Esta orden ya no está activa." };
  }
  if (order.channel === "comp") {
    return { open: false, headline: "Cortesía", detail: "Esta entrada no se pagó, así que no hay nada que devolver." };
  }
  if (policy === "none") {
    return {
      open: false,
      headline: "Esta compra no admite reembolsos",
      detail: "Así estaba indicado al momento de comprar.",
    };
  }
  const age = Date.now() - new Date(order.createdAt).getTime();
  if (age > REFUND_WINDOW_MS) {
    return {
      open: false,
      headline: "Pasaron más de 24 horas",
      detail: "El plazo para pedir reembolso ya venció.",
    };
  }
  return { open: true };
}

app.get("/reembolso/:orderId", async (c) => {
  const db = drizzle(c.env.DB, { schema: s });
  const found = await loadForRefund(db, c.req.param("orderId"));
  if (!found) return c.notFound();
  const { order, event, band } = found;
  const common = { band, event, order };

  const existing = await db
    .select()
    .from(s.refundRequests)
    .where(and(eq(s.refundRequests.orderId, order.id), eq(s.refundRequests.status, "open")))
    .limit(1);
  if (existing[0]) return c.html(<RefundSentPage {...common} />);

  const gate = refundGate(order, event.refundPolicy);
  if (!gate.open) {
    return c.html(<RefundClosedPage {...common} headline={gate.headline} detail={gate.detail} />);
  }
  return c.html(<RefundRequestPage {...common} policyText={event.refundPolicyText} />);
});

app.post("/reembolso/:orderId", async (c) => {
  const db = drizzle(c.env.DB, { schema: s });
  const found = await loadForRefund(db, c.req.param("orderId"));
  if (!found) return c.notFound();
  const { order, event, band } = found;
  const common = { band, event, order };

  const gate = refundGate(order, event.refundPolicy);
  if (!gate.open) {
    return c.html(<RefundClosedPage {...common} headline={gate.headline} detail={gate.detail} />);
  }

  const reason = String((await c.req.parseBody())["reason"] ?? "").trim().slice(0, 2000);
  if (!reason) {
    return c.html(
      <RefundRequestPage
        {...common}
        policyText={event.refundPolicyText}
        error="Contanos brevemente por qué."
      />,
      400,
    );
  }

  await db.insert(s.refundRequests).values({
    id: newId("ref"),
    orderId: order.id,
    requestedAt: nowIso(),
    reason,
    status: "open",
    handledBy: null,
    handledAt: null,
  });

  // The band decides and moves the money themselves; this just makes sure they
  // hear about it rather than finding it in the dashboard days later.
  c.executionCtx.waitUntil(
    makeTransport(c.env)
      .send({
        to: band.contactEmail,
        replyTo: order.payerEmail,
        subject: `Solicitud de reembolso — ${order.shortCode}`,
        html: `<!doctype html><html lang="es"><body style="margin:0;background:#f3f1ea;padding:26px 14px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif">
<table role="presentation" width="100%"><tr><td align="center"><table role="presentation" width="100%" style="max-width:460px;text-align:left">
<tr><td style="font:700 20px/1.25 inherit;color:#191713;padding-bottom:12px">Solicitud de reembolso</td></tr>
<tr><td style="font:400 15px/1.7 inherit;color:#57534b;padding-bottom:16px">
<b style="color:#191713">Orden:</b> ${escapeHtml(order.shortCode)}<br>
<b style="color:#191713">Evento:</b> ${escapeHtml(event.name)}<br>
<b style="color:#191713">Compró:</b> ${escapeHtml(order.payerName)} (${escapeHtml(order.payerEmail)})<br>
<b style="color:#191713">Boletos:</b> ${order.quantity} · ${formatLpsShort(order.expectedAmount)}
</td></tr>
<tr><td style="background:#fff;border:1px solid #ddd8cf;border-radius:10px;padding:14px 16px;font:400 15px/1.6 inherit;color:#57534b">
${escapeHtml(reason)}
</td></tr>
<tr><td style="padding-top:18px"><a href="${c.env.APP_ORIGIN}/admin/e/${event.slug}/orden/${order.id}" style="display:inline-block;padding:12px 20px;border-radius:9px;background:#191713;color:#fff;font:600 15px/1 inherit;text-decoration:none">Ver la orden</a></td></tr>
<tr><td style="font:400 12px/1.6 inherit;color:#8a857b;padding-top:20px">Respondé este correo para contactar directamente a quien compró.</td></tr>
</table></td></tr></table></body></html>`,
        text: `Solicitud de reembolso — ${order.shortCode}\n\nEvento: ${event.name}\nCompró: ${order.payerName} (${order.payerEmail})\nBoletos: ${order.quantity} · ${formatLpsShort(order.expectedAmount)}\n\n${reason}\n\nVer la orden: ${c.env.APP_ORIGIN}/admin/e/${event.slug}/orden/${order.id}`,
      })
      .then((r) => {
        if (!r.ok) console.error(`[refund] alert failed for ${order.shortCode}: ${r.error}`);
      }),
  );

  return c.html(<RefundSentPage {...common} />);
});

app.get("/admin/", (c) => c.redirect("/admin", 301));
app.route("/admin", admin);

/**
 * Scanner shell. Access is a per-event staff token in the URL rather than an
 * account: staff arrive with no login, often on a borrowed phone, at a venue
 * where a magic-link round-trip through an inbox is exactly what you cannot do.
 */
app.get("/scan/:token", async (c) => {
  const token = c.req.param("token");
  const db = drizzle(c.env.DB, { schema: s });
  const rows = await db
    .select({ event: s.events, band: s.bands })
    .from(s.events)
    .innerJoin(s.bands, eq(s.events.bandId, s.bands.id))
    .where(eq(s.events.staffToken, token))
    .limit(1);
  const found = rows[0];
  if (!found) return c.notFound();

  return c.html(`<!doctype html>
<html lang="es"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover,maximum-scale=1">
<meta name="theme-color" content="#0C0B09">
<meta name="robots" content="noindex,nofollow">
<title>Entrada — ${found.event.name}</title>
<link rel="manifest" href="/manifest.webmanifest">
<link rel="stylesheet" href="/scanner.css">
</head>
<body data-token="${token}">
<div class="wrap">
  <header>
    <div class="ev">${found.event.name}</div>
    <div class="vn">${found.event.venue} · ${found.band.name}</div>
    <span class="net" id="net">Cargando…</span>
  </header>

  <div class="stats">
    <div class="stat"><b id="statInside">0</b><span>Adentro</span></div>
    <div class="stat"><b id="statTotal">0</b><span>Vendidos</span></div>
    <div class="stat"><b id="statBands">—</b><span>Brazaletes</span></div>
  </div>
  <div id="queueRow" hidden><b id="statQueue">0</b> escaneos esperando conexión</div>

  <div class="tabs">
    <button class="tab on" data-tab="escanear">Escanear</button>
    <button class="tab" data-tab="buscar">Buscar</button>
    <button class="tab" data-tab="efectivo">Efectivo</button>
  </div>

  <section class="pane" data-pane="escanear">
    <button class="big" id="startBtn">Abrir cámara</button>
    <div id="cam" hidden><video id="video" muted playsinline></video></div>
    <canvas id="canvas" hidden></canvas>
    <div class="result" id="result" hidden></div>
  </section>

  <section class="pane" data-pane="buscar" hidden>
    <h2>Buscar por nombre</h2>
    <p class="hint" style="margin-top:0">Para quien no encuentra su código.</p>
    <input type="text" id="searchInput" placeholder="Nombre o código" autocomplete="off">
    <div id="searchResults"></div>
  </section>

  <section class="pane" data-pane="efectivo" hidden>
    <h2>Venta en efectivo</h2>
    <p class="hint" style="margin-top:0">Cobrás, registrás, ponés el brazalete.</p>
    <div class="qty">
      <button type="button" id="cashMinus" aria-label="Menos">−</button>
      <input type="number" id="cashQty" value="1" min="1" max="20" inputmode="numeric">
      <button type="button" id="cashPlus" aria-label="Más">+</button>
    </div>
    <button class="big" id="cashBtn">Registrar venta</button>
    <button class="ghost" id="compBtn">Registrar cortesía</button>
    <p class="hint" id="cashNote"></p>
  </section>
</div>
<script src="/vendor/jsQR.js"></script>
<script src="/scanner.js"></script>
</body></html>`);
});

app.get("/", (c) => c.html(<LandingPage />));

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
  console.error(`unhandled: ${err instanceof Error ? err.stack ?? err.message : String(err)}`);
  return c.html(
    `<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1">
     <body style="font-family:system-ui;background:#0C0B09;color:#F6F2EB;padding:48px 24px;text-align:center">
     <h1>Algo salió mal</h1>
     <p style="color:#A79E90">Volvé a intentarlo. Si ya transferiste, escribinos y lo resolvemos.</p></body>`,
    500,
  );
});

export default app;
